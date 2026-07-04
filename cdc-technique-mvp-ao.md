# Cahier des charges technique — MVP « Usine à dossiers AO »

**Version** 1.0 — 04/07/2026
**Destinataire** : Baptiste (dev) · **Pilote** : Liquid (métier, pilotes clients)
**Objet** : outil interne de production de réponses aux appels d'offres publics, secteur pilote propreté, ramenant le temps humain par dossier de ~30 h à ~2 h.

---

## 1. Contexte et parti pris

Le business model est le service-as-software : on vend le livrable (un dossier de réponse déposé, ~690 €, garantie 72 h), pas un logiciel. Ce document spécifie donc **l'outil interne** qui rend ce prix rentable — pas un SaaS avec portail client. Conséquences structurantes :

- **Utilisateurs : nous deux.** Pas d'onboarding self-serve, pas de facturation intégrée, pas de design poussé. Une interface fonctionnelle suffit.
- **Human-in-the-loop obligatoire.** Chaque dossier est relu et validé par un humain avant envoi au client. C'est à la fois le modèle commercial (nous engageons notre responsabilité sur la qualité) et le garde-fou technique contre les hallucinations.
- **Le go/no-go fait partie du produit.** On refuse les dossiers à faible probabilité de gain ; l'outil doit donc scorer, pas seulement rédiger.
- Les concurrents SaaS (Tengo, Tenderbolt, Remporte, MA-IA…) vendent l'outil aux PME qui répondent déjà. Notre avantage n'est pas d'avoir un meilleur outil qu'eux, c'est de l'exploiter nous-mêmes sur le segment des PME qui ne répondent jamais. Donc : **vitesse de construction > sophistication.**

## 2. Où passent les 30 heures, et où on les récupère

| Poste | Aujourd'hui | Cible MVP | Levier |
|---|---|---|---|
| Veille et sélection des AO | 2–3 h | hors périmètre (v2) | — |
| Lecture et analyse du DCE (100–300 pages) | 4–6 h | **15–20 min** | Fiche AO générée automatiquement |
| Dossier administratif (DC1/DC2, attestations) | 2–3 h | **10–15 min** | Coffre-fort documentaire + remplissage auto |
| Mémoire technique (12–40 pages) | 12–18 h | **60–75 min** | Draft IA à partir de la base client + relecture |
| Chiffrage (BPU / DQE / DPGF) | 3–5 h | inchangé (humain) | v2 |
| Relecture, mise en forme, dépôt | 2–3 h | **20–30 min** | Checklist de conformité + templates docx |

**Lecture honnête du « 30 h → 2 h »** : l'objectif de 2 h s'entend hors chiffrage, qui reste un acte de jugement métier (et souvent celui du client pilote lui-même). 80 % du gain vient de deux postes : l'analyse du DCE et le mémoire technique. C'est là que se concentre l'effort de développement.

## 3. Périmètre

### Dans le MVP — 4 modules

1. **M1 — Ingestion et analyse du DCE** : du ZIP téléchargé à la Fiche AO structurée + score go/no-go.
2. **M2 — Base de connaissances client (KB)** : tout ce qu'on sait d'une PME cliente, structuré et indexé.
3. **M3 — Générateur de mémoire technique** : draft complet en docx, ancré sur la KB, avec rapport des manques.
4. **M4 — Dossier administratif et conformité** : coffre-fort des pièces, remplissage DC1/DC2, checklist de dépôt.

### Hors MVP (explicitement)

Veille automatique multi-plateformes (BOAMP/TED/profils acheteurs), dépôt automatisé sur les plateformes, signature électronique, chiffrage assisté, DUME via API, portail client, multi-utilisateurs/multi-tenant self-serve, facturation, Chorus Pro. **Règle anti-dérive : toute fonctionnalité qui n'accélère pas directement un des quatre postes ciblés est refusée jusqu'au jalon 3.**

---

## 4. Spécifications par module

### M1 — Ingestion et analyse du DCE

**Entrée** : un ZIP (ou des fichiers en vrac) téléchargé depuis le profil d'acheteur. Contenu typique : RC, CCAP, CCTP, AE, BPU/DQE/DPGF, annexes (plans, cadre de réponse, attestation de visite…). Formats : PDF (natif ou scanné), DOCX, XLSX.

**Pipeline** :

1. Dézippage récursif, déduplication.
2. Classification de chaque pièce (RC / CCAP / CCTP / AE / prix / annexe) — règles sur le nom de fichier + passe LLM sur la première page en cas d'ambiguïté.
3. Extraction texte : PyMuPDF pour les PDF natifs ; détection des pages image → OCR (Tesseract `fra` en local, API OCR en fallback si qualité insuffisante). DOCX via python-docx, XLSX via openpyxl.
4. Stockage du texte normalisé avec **ancrage par page** (indispensable pour la traçabilité, cf. §6).
5. Extraction structurée en deux passes LLM (extraction puis auto-vérification), sortie JSON contrainte par schéma.

**Schéma cible de la Fiche AO** (à affiner, mais voilà la colonne vertébrale) :

```json
{
  "reference": "",
  "acheteur": { "nom": "", "type": "commune|departement|bailleur|hopital|etat|autre", "profil_acheteur_url": "" },
  "objet": "",
  "procedure": "MAPA|appel_offres_ouvert|autre",
  "allotissement": [ { "num": 1, "intitule": "", "estimation_eur": null } ],
  "date_limite_offres": "ISO-8601",
  "visite": { "obligatoire": false, "dates": [], "contact": "" },
  "duree": { "initiale_mois": 12, "reconductions": 3 },
  "criteres": [ { "libelle": "Valeur technique", "ponderation": 60, "sous_criteres": [] } ],
  "cadre_reponse_impose": { "present": false, "fichier": null },
  "pieces_candidature": [ "DC1", "DC2", "attestations fiscales et sociales" ],
  "pieces_offre": [ "AE", "BPU", "memoire technique" ],
  "exigences_bloquantes": [ { "type": "certification|ca_min|references|effectif", "detail": "", "source": { "fichier": "RC.pdf", "page": 4 } } ],
  "clauses_notables": [ { "type": "penalite|revision_prix|insertion|reprise_personnel|rse", "detail": "", "source": {} } ],
  "questions_a_poser": [],
  "red_flags": []
}
```

**Règle d'or : chaque champ extrait porte sa source (fichier + page)** et l'interface permet de cliquer pour vérifier. C'est ce qui transforme « l'IA a lu le DCE » en « je peux faire confiance en 15 minutes ».

**Score go/no-go** : croisement des `exigences_bloquantes` avec le profil du client (M2) + heuristiques simples (estimation du marché vs CA client, distance géographique, délai restant, nombre de candidats attendus si connu). Sortie : GO / NO-GO / GO sous conditions, avec les raisons listées. Pas de ML ici — des règles lisibles suffisent au MVP.

**Critères d'acceptation M1** :
- Sur un jeu de 10 DCE réels du secteur propreté : ≥ 95 % d'exactitude sur les champs critiques (date limite, critères et pondérations, pièces exigées, visite obligatoire).
- Traitement d'un DCE de 300 pages en < 5 min.
- 100 % des champs affichés traçables à leur page source.
- Coût LLM + OCR < 3 € par DCE.

### M2 — Base de connaissances client

Une KB par client pilote, en deux couches :

**Couche structurée** (formulaires + import) : identité (SIREN, Kbis), CA des 3 derniers exercices, effectifs, encadrement, moyens matériels et produits (avec écolabels le cas échéant), certifications et labels (fichier + date d'expiration), assurances, références de marchés (fiche par référence : client, objet, montant, durée, effectifs affectés, contact, résultats mesurables), CV et habilitations des encadrants, politique QSE/RSE.

**Couche corpus** (RAG) : anciens mémoires techniques du client, plaquettes, procédures internes. Découpage sémantique, embeddings multilingues, index pgvector, métadonnées (client, type de prestation, date, gagné/perdu si connu).

**Spécificités propreté à modéliser dès le départ** : la reprise du personnel (Article 7 de la convention collective — argument commercial central et section attendue du mémoire), les plans de nettoyage type (zones × fréquences × modes opératoires), la grille produits/matériel.

**Contrainte critique : isolation stricte par client.** Nos pilotes propreté seront concurrents entre eux. Le retrieval du client A ne doit jamais pouvoir toucher le corpus du client B — isolation au niveau requête ET au niveau schéma de données, testée. Seule notre bibliothèque interne (trames génériques que nous rédigeons nous-mêmes, sans données client) est mutualisée.

**Critères d'acceptation M2** :
- Onboarding complet d'un client pilote (saisie + import + indexation) en < 1 journée de notre temps.
- Alerte automatique à J-30 avant expiration d'une attestation ou certification.
- Test d'isolation : aucune fuite inter-clients sur un jeu de requêtes adverses.

### M3 — Générateur de mémoire technique

C'est le module qui porte l'essentiel de la promesse. Logique en quatre temps :

1. **Détermination du plan.** Si le DCE impose un cadre de réponse (docx ou xlsx) : le parser et le respecter à la lettre — ne jamais y déroger, c'est éliminatoire. Sinon : plan dérivé des critères et sous-critères pondérés + trame sectorielle propreté (présentation, moyens humains et reprise du personnel, moyens matériels et produits, organisation et méthodologie avec plan de nettoyage, contrôle qualité, hygiène-sécurité, gestion des absences et remplacements, démarche environnementale/RSE, planning de démarrage).
2. **Génération section par section**, chaque section avec un retrieval ciblé sur la KB du client + le contexte de la Fiche AO (acheteur, site, contraintes du CCTP, clauses notables). La pondération des critères pilote la profondeur : une section qui pèse 30 % de la note mérite trois fois plus de matière qu'une à 10 %.
3. **Règle anti-hallucination, non négociable** : interdiction d'inventer chiffres, références, certifications ou noms. Toute information manquante produit un marqueur `[À COMPLÉTER : …]` dans le texte et une ligne dans le **rapport des manques** livré avec le draft. Un mémoire avec des trous honnêtes vaut infiniment mieux qu'un mémoire fluide et faux — c'est notre responsabilité contractuelle qui est en jeu.
4. **Assemblage docx** (docxtpl / python-docx) : template aux couleurs du client, page de garde, sommaire automatique, styles propres. Sortie éditable dans Word — au MVP, la « relecture » se fait dans Word, pas dans notre interface.

**Critères d'acceptation M3** :
- Draft complet (plan imposé ou dérivé) en < 10 min.
- Sur les dossiers pilotes : ≥ 70 % des sections conservées avec modifications mineures à la relecture.
- Zéro fait inventé détecté en relecture (les manques sont marqués, jamais comblés).
- Chaque section affiche le ou les critères de notation qu'elle adresse.
- Coût LLM < 5 € par mémoire.

### M4 — Dossier administratif et conformité

**Coffre-fort** : les pièces du client typées avec leur durée de validité (attestation de vigilance URSSAF : 6 mois ; attestation fiscale : millésime ; Kbis : 3 mois d'usage ; assurances : annuelles ; certifications : selon échéance). Statut à jour / bientôt expiré / expiré.

**Remplissage automatique** : DC1 et DC2 (formulaires DAJ) générés par publipostage docx depuis la couche structurée de M2, plus le tableau de références formaté selon les exigences du RC. Le DUME reste manuel au MVP (l'intégration API viendra si le volume le justifie).

**Checklist de conformité** : générée automatiquement depuis `pieces_candidature` et `pieces_offre` de la Fiche AO. Chaque pièce : fournie / manquante / expirée. Alertes à J-7 et J-2 de la date limite. Blocage visuel (pas d'export du dossier final) tant qu'une pièce exigée manque.

**Critères d'acceptation M4** :
- DC1/DC2 générés sans aucune ressaisie pour un client onboardé.
- Checklist exhaustive par rapport au RC sur les 10 DCE du jeu de test.
- Aucun dossier pilote parti incomplet.

---

## 5. Architecture et stack

```
[Front interne Next.js minimal]
        │ HTTPS
[API FastAPI (Python 3.12)]
        │
[Queue Redis + workers (RQ)]  ← jobs longs : parsing, OCR, extraction, génération
        │
[PostgreSQL + pgvector]   [Object storage S3 (Scaleway/OVH)]
        │
[Claude API]  [OCR local Tesseract / API en fallback]  [Embeddings multilingues]
```

Choix et justifications :

- **Python/FastAPI** : le meilleur écosystème pour le traitement documentaire et le LLM ; c'est aussi le chemin le plus court pour un dev seul.
- **Postgres + pgvector** : une seule base pour le relationnel et le vectoriel — pas de brique vector store dédiée au MVP.
- **Workers asynchrones** dès le départ : l'analyse d'un DCE et la génération d'un mémoire sont des jobs de plusieurs minutes ; l'API ne doit jamais bloquer.
- **Claude API** : Sonnet pour la classification et l'extraction structurée (rapport coût/qualité), option modèle supérieur pour la génération du mémoire si la qualité l'exige — à trancher au jalon 2 sur des exemples réels.
- **Hébergement France/UE (Scaleway ou OVH)** : les données clients (CA, prix, références, mémoires) sont commercialement sensibles ; la souveraineté est aussi un argument de vente auprès des PME.
- **Sortie docx systématique** : Word est le format dans lequel nous relisons et dans lequel les acheteurs attendent les pièces.

## 6. Exigences non fonctionnelles

- **Confidentialité** : chiffrement au repos, isolation des données par client (cf. M2), engagement contractuel de non-réutilisation des données d'un client au profit d'un autre, pas d'entraînement de modèles sur les données clients.
- **Traçabilité de bout en bout** : toute donnée extraite pointe vers sa page source ; tout paragraphe généré journalise les passages de la KB utilisés. C'est notre outil de contrôle qualité interne et, plus tard, un argument produit.
- **Performance** : Fiche AO < 5 min, mémoire < 10 min, coût variable IA total < 10 € par dossier (négligeable face aux 690 € facturés).
- **Robustesse** : tout job peut être rejoué ; un échec d'OCR sur une annexe ne bloque pas l'analyse du reste du DCE (les pages illisibles sont signalées, pas silencieusement ignorées).

## 7. Planning — 1 dev, 10 semaines, 3 jalons

| Semaines | Contenu | Jalon |
|---|---|---|
| S1–S2 | Socle : repo, infra, storage, auth basique, pipeline parsing + OCR | — |
| S3–S4 | Extraction Fiche AO + go/no-go + écran de vérification avec sources | **J1 : « DCE → Fiche en 5 min »**, évalué sur 10 DCE réels |
| S5 | KB client : modèle de données, formulaires d'import, indexation RAG | — |
| S6–S8 | Générateur de mémoire : plans, retrieval, génération, templates docx, rapport des manques | **J2 : premier mémoire livré à un vrai pilote** |
| S9 | Coffre-fort, DC1/DC2, checklist de conformité, alertes | — |
| S10 | Durcissement + test de bout en bout chronométré sur 3 AO réels | **J3 : un dossier complet en ≤ 2 h, documenté** |

Le jalon 3 produit l'actif commercial : la preuve chronométrée du 30 h → 2 h, qui devient la slide du pitch (The Quest, pre-seed) et le fondement des unit economics à 690 €/dossier.

## 8. Dépendances côté Liquid (bloquantes pour Baptiste)

1. **Dès cette semaine** : constituer le jeu de test — 10 à 15 DCE réels du secteur propreté, téléchargeables gratuitement sur les profils d'acheteurs (BOAMP → plateforme de l'acheteur). Sans ça, S3–S4 tournent à vide.
2. **Avant S5** : 2–3 PME pilotes engagées, avec leurs documents (anciens mémoires, attestations, références, certifications).
3. **Avant S6** : trame de mémoire type propreté validée avec un pilote (c'est toi qui portes l'expertise métier de ce qui fait gagner).
4. **En continu** : la relecture des drafts et le feedback structuré (sections conservées / réécrites / manquantes) — c'est la boucle d'amélioration du générateur.

## 9. Métriques de succès du MVP

- Temps humain chronométré par dossier ≤ 2 h (hors chiffrage), mesuré sur 3 dossiers réels au jalon 3.
- Exactitude d'extraction ≥ 95 % sur les champs critiques.
- Taux de réutilisation du draft de mémoire ≥ 70 %.
- Zéro dossier déposé incomplet ou hors délai.
- Coût variable IA < 10 €/dossier.
- (Après le MVP) taux de gain des dossiers déposés — la seule métrique qui compte à terme.

## 10. Risques techniques et parades

| Risque | Parade |
|---|---|
| DCE scannés de mauvaise qualité (annexes, vieux plans) | OCR API en fallback ; pages illisibles signalées explicitement dans la Fiche AO |
| Cadres de réponse exotiques (xlsx à cases, formulaires verrouillés) | Traitement manuel assisté au début — on ne sur-ingénierise pas pour 10 % des cas |
| Hallucination dans le mémoire | Grounding strict sur la KB + marqueurs `[À COMPLÉTER]` + relecture humaine obligatoire (c'est aussi le modèle de service) |
| Variabilité des RC (structure, vocabulaire) | Extraction en deux passes avec auto-vérification ; l'humain garde 15 min de contrôle sur la fiche |
| Fuite de données entre clients concurrents | Isolation testée par requêtes adverses avant tout deuxième pilote |
| Dérive de périmètre | Règle du §3 : rien qui n'accélère pas les 4 postes avant J3 |

---

*Document de travail — à verser dans le repo et à itérer avec Baptiste. Prochaine mise à jour attendue après le jalon 1 (retours du jeu de test réel).*

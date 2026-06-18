# NOUVEAUTES.md — SmartInvoice AI

> **Document généré le 23 mai 2026** — Analyse exhaustive du code source réel.
> Compare l'état actuel du projet à la version précédemment documentée dans le rapport de PFE.

---

## 1. Résumé exécutif

Depuis la version documentée dans le rapport de PFE, SmartInvoice AI a connu une évolution majeure de son architecture d'intelligence artificielle et un enrichissement fonctionnel substantiel. Le moteur d'extraction a été refondu : l'API Claude d'Anthropic (`claude-sonnet-4-20250514`) remplace désormais Groq en tant que LLM principal, Ollama étant conservé en fallback. Cinq fonctionnalités entièrement nouvelles ont été développées : un système complet de partage et d'importation de factures par QR code (génération, scan caméra en temps réel, import inter-organisations), une interface de vérification humaine des extractions avec scores de confiance par champ et vue écran scindé, un classificateur automatique biens/services trilingue, un vérificateur de signatures numériques XML (XMLDSig/X.509), et un référentiel de 129 devises internationales. Le backend de notifications a été entièrement reconstruit avec persistance MongoDB (3 nouvelles collections), préférences utilisateur et templates. Le projet passe de ~29 400 à ~35 900 lignes de code, de 8 à 11 collections MongoDB, et de ~70 à 85 endpoints REST.

---

## 2. Tableau récapitulatif des statistiques

| Métrique | Ancien (rapport PFE) | Nouveau (actuel) | Évolution |
|---|---|---|---|
| **Lignes de code — Backend (Python)** | *(inclus dans 29 400)* | **10 215** | — |
| **Lignes de code — Frontend (TS/TSX)** | *(inclus dans 29 400)* | **25 706** | — |
| **Lignes de code — Total** | ~29 400 | **~35 921** | **+22 %** |
| **Endpoints REST** | 70+ | **85** | **+15** |
| **Modules/fichiers Python backend** | 18 | **24** (dont 19 services) | **+6** |
| **Composants React (hors UI lib)** | — | **22** | — |
| **Composants UI Radix** | — | **46** | — |
| **Collections MongoDB** | 8 | **11** | **+3** |
| **Conteneurs Docker** | 5 | **5** | = |
| **Langues supportées (i18n)** | 3 (EN/FR/AR) | **3** (EN/FR/AR) | = |
| **Devises référencées** | 3 (TND/EUR/USD) | **129** | **+126** |
| **LLM principal** | Ollama (local) | **Claude API** (Anthropic) | Changé |
| **LLM fallback** | Groq (cloud) | **Ollama** (local) | Changé |

### Détail des collections MongoDB (11)

| # | Collection | Statut |
|---|---|---|
| 1 | `users` | Existante |
| 2 | `organizations` | Existante |
| 3 | `memberships` | Existante |
| 4 | `invitations` | Existante |
| 5 | `invoices` | Existante (champs ajoutés) |
| 6 | `activity_log` | Existante |
| 7 | `withholding_certificates` | Existante |
| 8 | `ttn_audit_trail` | Existante |
| 9 | `notifications` | **Nouvelle** |
| 10 | `notification_preferences` | **Nouvelle** |
| 11 | `notification_templates` | **Nouvelle** |

### Détail des composants React applicatifs (22)

| # | Composant | Lignes | Statut |
|---|---|---|---|
| 1 | `InvoiceManagement.tsx` | 3 099 | Existant |
| 2 | `AIExtraction.tsx` | 1 785 | Existant |
| 3 | `InvoiceVerification.tsx` | 1 211 | **Nouveau** |
| 4 | `WithholdingTax.tsx` | 1 161 | Existant |
| 5 | `ScanImport.tsx` | 1 107 | **Nouveau** |
| 6 | `NotificationSystem.tsx` | 1 095 | Existant |
| 7 | `Authentication.tsx` | 852 | Existant |
| 8 | `UserManagement.tsx` | 700 | Existant |
| 9 | `LandingPage.tsx` | 641 | Existant |
| 10 | `Dashboard.tsx` | 629 | Existant |
| 11 | `CompliancePanel.tsx` | 482 | **Nouveau** |
| 12 | `AuditTrail.tsx` | 474 | Existant |
| 13 | `AIAdvisor.tsx` | 427 | Existant |
| 14 | `OrgSettings.tsx` | 408 | Existant |
| 15 | `TeamManagement.tsx` | 366 | Existant |
| 16 | `CertificateViewer.tsx` | 289 | Existant |
| 17 | `WithholdingDashboard.tsx` | 280 | Existant |
| 18 | `CertificateList.tsx` | 246 | Existant |
| 19 | `NotificationBell.tsx` | 219 | Existant |
| 20 | `OrgSwitcher.tsx` | 170 | Existant |
| 21 | `Providers.tsx` | 24 | Existant |
| 22 | `ImageWithFallback.tsx` | — | Existant |

---

## 3. NOUVELLES FONCTIONNALITES

---

### [NOUVEAU] Partage et importation de factures par QR code

- **Description** : Le système introduit un mécanisme complet de partage inter-organisations de factures fondé sur des codes QR. Chaque facture se voit attribuer un code de partage unique au format `INV-XXXXXXXX` (8 caractères alphanumériques), généré automatiquement lors de la création. Ce code est encodé dans un QR code au format PNG contenant les métadonnées fiscales essentielles (numéro de facture, date, fournisseur, montant total, taxe, devise) ainsi qu'un checksum SHA-256 tronqué à 16 caractères garantissant l'intégrité des données. L'importation permet à tout utilisateur authentifié de copier une facture dans son organisation, avec traçabilité complète de l'origine, prévention des doublons et attribution d'un nouveau code de partage à la copie.

- **Fichiers concernés** :
  - Backend : `backend/app.py` (fonctions `generate_share_code`, `generate_invoice_qrcode`, `get_invoice_qrcode_data`, `lookup_invoice_by_code`, `get_share_info`, `import_invoice_by_code`)
  - Frontend : `Front-end/pfe-project/src/components/ScanImport.tsx` (1 107 lignes)
  - Frontend : `Front-end/pfe-project/src/app/(routes)/scan/page.tsx`

- **Nouveaux endpoints** :

| Méthode | Route | Description | Auth/Rôle requis |
|---|---|---|---|
| GET | `/api/invoices/<id>/qrcode` | Génère le QR code au format PNG | `@token_required`, `@org_required` |
| GET | `/api/invoices/<id>/qrcode-data` | Retourne le payload QR en JSON | `@token_required`, `@org_required` |
| GET | `/api/invoices/<id>/share-info` | Retourne le code de partage + données QR | `@token_required`, `@org_required` |
| GET | `/api/invoices/lookup/<share_code>` | Recherche une facture par code de partage | `@token_required` |
| POST | `/api/invoices/import/<share_code>` | Importe (copie) une facture dans l'organisation courante | `@token_required`, `@org_required` |

- **Données** :
  - Nouveaux champs sur la collection `invoices` :
    - `share_code` (string) — code unique INV-XXXXXXXX
    - `imported_from` (string) — share_code de la facture source (si importée)
    - `imported_at` (string ISO 8601) — date d'importation
    - `tags: ["imported"]` — tag automatique sur les factures importées

- **Services externes** : Aucun (bibliothèque Python `qrcode` pour la génération côté serveur)

- **Intérêt fonctionnel** : Permet le partage sécurisé de factures entre organisations (par exemple entre un fournisseur et son client) via un simple scan de QR code depuis un appareil mobile ou un fichier image, sans nécessiter d'accès partagé à l'organisation d'origine.

---

### [NOUVEAU] Scan QR par caméra en temps réel (composant frontend)

- **Description** : Le composant `ScanImport` offre une interface complète de numérisation de QR codes, exploitant le flux vidéo en temps réel de la caméra de l'appareil via l'API `getUserMedia`. Un algorithme de détection multi-résolution (1024px → 1600px → 2400px) avec prétraitement en niveaux de gris et rehaussement de contraste assure une reconnaissance fiable même dans des conditions d'éclairage défavorables ou à partir de photographies de QR codes. En cas d'indisponibilité de la caméra (absence de HTTPS, permissions refusées), le système bascule automatiquement vers un mode de téléversement d'image depuis la galerie. Un mode de saisie manuelle du code de partage est également disponible. L'interface affiche un aperçu complet de la facture détectée avant confirmation de l'importation.

- **Fichiers concernés** :
  - Frontend : `Front-end/pfe-project/src/components/ScanImport.tsx` (1 107 lignes)
  - Dépendances : `jsqr@1.4.0` (détection QR depuis canvas), `qrcode.react@4.2.0` (affichage React)

- **Nouveaux endpoints** : Aucun endpoint supplémentaire (utilise les endpoints de partage ci-dessus)

- **Services externes** : Aucun (traitement entièrement côté client)

- **Intérêt fonctionnel** : Offre une expérience utilisateur fluide et mobile-first pour l'importation de factures partagées, avec retour haptique à la détection, animation de scan, et gestion gracieuse des erreurs de permission caméra.

---

### [NOUVEAU] Interface de vérification et d'édition humaine des extractions

- **Description** : Le composant `InvoiceVerification` propose une interface de vérification en écran scindé (split-view) permettant à l'utilisateur de confronter visuellement le document original (PDF ou image) aux données extraites par l'IA. L'interface se décompose en deux modes : un mode « Vérifier » affichant les champs extraits avec leurs scores de confiance individuels (codés par couleur : vert ≥80 %, jaune 50-79 %, rouge <50 %), et un mode « Éditer » permettant la modification inline de chaque champ, y compris les lignes de détail de la facture. Un système de suivi des modifications (change tracking) met en évidence les champs modifiés par rapport à l'extraction originale et affiche un compteur de changements. Des raccourcis clavier (Ctrl+S pour sauvegarder, Echap pour annuler, 1/2 pour basculer entre les écrans, ? pour l'aide) accélèrent le flux de travail.

- **Fichiers concernés** :
  - Frontend : `Front-end/pfe-project/src/components/InvoiceVerification.tsx` (1 211 lignes)
  - Intégré dans : `Front-end/pfe-project/src/components/AIExtraction.tsx` (flux post-extraction)

- **Nouveaux endpoints** : Aucun (utilise `PUT /api/invoices/<id>` existant pour sauvegarder les corrections)

- **Données** :
  - Exploite les champs existants `data.field_confidence` (objet de scores par champ) et `data.validation.needs_human_review` (booléen)

- **Services externes** : Aucun

- **Intérêt fonctionnel** : Réduit significativement le taux d'erreur des extractions automatiques en permettant une revue humaine guidée par les scores de confiance. Le split-view élimine les allers-retours entre le document et les données, tandis que le suivi des modifications assure une traçabilité complète des corrections apportées.

---

### [NOUVEAU] Classification automatique biens/services des factures

- **Description** : Le module `service_detector` implémente un classificateur automatique qui détermine si une facture concerne des biens, des services, ou un mélange des deux. La classification s'appuie sur un dictionnaire trilingue (anglais, français, arabe) de mots-clés catégorisant les descriptions de lignes de facture, complété par une détection de motifs temporels (durée, taux horaire/journalier) et une heuristique basée sur les quantités et prix unitaires. Pour chaque ligne, le système extrait les métadonnées spécifiques aux services (durée, unité, taux) lorsqu'elles sont disponibles. Cette classification est exécutée automatiquement à chaque extraction, qu'elle soit réalisée par IA ou par parsing XML.

- **Fichiers concernés** :
  - Backend : `backend/services/service_detector.py` (247 lignes)
  - Appelé depuis : `backend/services/extractor_core.py` (fonction `extract_from_file`)

- **Nouveaux endpoints** : Aucun (classification automatique intégrée au flux d'extraction)

- **Données** :
  - Nouveaux champs sur la collection `invoices` :
    - `invoice_category` (string) — `"goods"` | `"services"` | `"mixed"`
    - `category_confidence` (string) — `"high"` | `"medium"` | `"low"`
    - `service_fields` (array) — détails par ligne : `{description, type, duration_value, duration_unit, rate}`

- **Services externes** : Aucun

- **Intérêt fonctionnel** : La distinction biens/services est une exigence réglementaire de la facturation électronique tunisienne 2026, les prestations de services étant soumises à des obligations déclaratives spécifiques. La classification automatique évite à l'utilisateur cette catégorisation manuelle fastidieuse et alimente le calcul de conformité.

---

### [NOUVEAU] Vérification de signatures numériques XML

- **Description** : Le module `signature_validator` fournit un service de vérification des signatures numériques XMLDSig intégrées aux factures électroniques au format XML. Le validateur vérifie la présence et la structure de la signature, extrait et analyse le certificat X.509 associé (sujet, émetteur, dates de validité, type et taille de clé), évalue la robustesse de l'algorithme cryptographique utilisé (rejet de MD5 et SHA-1, acceptation de SHA-256+) et contrôle les exigences minimales de taille de clé (RSA 2048 bits, ECDSA 256 bits). Le résultat inclut un diagnostic complet avec avertissements et erreurs hiérarchisés.

- **Fichiers concernés** :
  - Backend : `backend/services/signature_validator.py` (311 lignes)
  - Backend : `backend/app.py` (route `verify_signature_endpoint`)
  - Frontend : `Front-end/pfe-project/src/components/CompliancePanel.tsx` (intégration UI)

- **Nouveaux endpoints** :

| Méthode | Route | Description | Auth/Rôle requis |
|---|---|---|---|
| POST | `/api/invoices/<id>/verify-signature` | Vérifie la signature numérique XMLDSig | `@token_required`, `@org_required` |

- **Données** :
  - Nouveau champ sur la collection `invoices` :
    - `signature_validation` (object) — `{has_signature, signature_valid, algorithm, certificate: {subject, issuer, not_before, not_after, key_type, key_bits, is_expired}, errors[], warnings[]}`

- **Services externes** : Aucun (bibliothèque Python `cryptography` pour le parsing X.509)

- **Intérêt fonctionnel** : La vérification de signature numérique est une composante essentielle de la conformité e-invoicing tunisienne 2026. Elle garantit l'authenticité et l'intégrité des factures XML reçues, permettant aux entreprises de valider la provenance d'une facture avant son traitement comptable.

---

### [NOUVEAU] Panneau de conformité unifié

- **Description** : Le composant `CompliancePanel` offre une vue consolidée de l'ensemble des vérifications de conformité applicables à une facture : validation réglementaire (champs obligatoires, format TVA, arithmétique), vérification de signature numérique, statut de soumission TTN El Fatoora, et génération de QR code de conformité. Chaque vérification est présentée avec son statut (réussi/échoué/en attente), ses erreurs et avertissements détaillés, et un score de conformité global. Le panneau est intégré dans la vue détaillée de chaque facture au sein du composant `InvoiceManagement`.

- **Fichiers concernés** :
  - Frontend : `Front-end/pfe-project/src/components/CompliancePanel.tsx` (482 lignes)
  - Intégré dans : `Front-end/pfe-project/src/components/InvoiceManagement.tsx`
  - Backend : `backend/app.py` (route `get_compliance_report`)

- **Nouveaux endpoints** :

| Méthode | Route | Description | Auth/Rôle requis |
|---|---|---|---|
| GET | `/api/invoices/<id>/compliance-report` | Rapport de conformité complet (validation + signature + TTN) | `@token_required`, `@org_required` |

- **Services externes** : Aucun

- **Intérêt fonctionnel** : Centralise en un seul écran toutes les vérifications de conformité, évitant à l'utilisateur de naviguer entre plusieurs interfaces pour évaluer la conformité globale d'une facture. Le rapport consolidé facilite la prise de décision avant soumission aux autorités fiscales.

---

### [NOUVEAU] Référentiel de 129 devises internationales

- **Description** : Le module `currencies.ts` fournit un référentiel structuré de 129 devises mondiales, organisées par région géographique (Afrique du Nord et Moyen-Orient, Afrique subsaharienne, Europe hors zone euro, Asie-Pacifique, Amériques, et devises majeures mondiales). Chaque entrée comprend le code ISO 4217, le symbole monétaire et le nom complet de la devise. Le dinar tunisien (TND) est positionné en priorité dans la catégorie Afrique du Nord. Ce référentiel alimente les sélecteurs de devise dans l'ensemble de l'application : extraction de factures, certificats de retenue à la source TEJ, rapports et exports.

- **Fichiers concernés** :
  - Frontend : `Front-end/pfe-project/src/lib/currencies.ts` (129 lignes)
  - Utilisé par : `InvoiceManagement.tsx`, `WithholdingTax.tsx`, `AIExtraction.tsx`, `InvoiceVerification.tsx`

- **Nouveaux endpoints** : Aucun

- **Données** : Structure `Currency { code: string, symbol: string, name: string }`

- **Services externes** : Aucun

- **Intérêt fonctionnel** : Étend considérablement la portée internationale de la plateforme, passant de 3 devises en dur (TND/EUR/USD) à 129 devises couvrant toutes les régions du monde, ce qui est indispensable pour les entreprises tunisiennes opérant à l'international ou traitant des factures en devises étrangères.

---

### [NOUVEAU] Upload de logo et signature sur les factures

- **Description** : Le système permet désormais d'associer un logo d'entreprise et une signature manuscrite numérisée à chaque facture lors de sa création manuelle. Ces éléments sont stockés en encodage Base64 directement dans le document de la facture au sein de MongoDB. Le logo est également supporté au niveau de l'organisation (champ `logo_url` dans la collection `organizations`), permettant un branding cohérent sur l'ensemble des documents produits.

- **Fichiers concernés** :
  - Backend : `backend/app.py` (route `POST /api/invoices` — champs `logo`, `signature`)
  - Backend : `backend/services/org_service.py` (champ `logo_url` sur organisations)
  - Frontend : `Front-end/pfe-project/src/components/InvoiceManagement.tsx` (upload UI)

- **Nouveaux endpoints** : Aucun (intégré aux endpoints existants de création/mise à jour)

- **Données** :
  - Nouveaux champs sur la collection `invoices` :
    - `logo` (string, Base64) — logo de l'entreprise
    - `signature` (string, Base64) — signature manuscrite numérisée
  - Nouveau champ sur la collection `organizations` :
    - `logo_url` (string) — URL ou Base64 du logo de l'organisation

- **Services externes** : Aucun

- **Intérêt fonctionnel** : Permet la personnalisation visuelle des factures avec l'identité graphique de l'entreprise, exigence fréquente dans les contextes professionnels et réglementaires tunisiens.

---

### [NOUVEAU] Système de notifications persistant avec préférences et templates

- **Description** : Le module `notification_system_backend` constitue une refonte complète du système de notifications, ajoutant une couche de persistance MongoDB aux notifications éphémères MagicBell existantes. Le système introduit trois nouvelles collections : `notifications` pour le stockage paginé et durable des notifications in-app (avec TTL de 90 jours), `notification_preferences` pour les préférences par utilisateur et par canal (in-app, email, SMS), et `notification_templates` pour les modèles de notification paramétrables par catégorie. Un blueprint Flask dédié (`notification_bp`) expose 11 endpoints REST couvrant la lecture, le marquage lu/non-lu, la suppression, la gestion des préférences, la diffusion administrative et les tests. L'architecture asynchrone via Celery garantit que l'envoi de notifications (email SMTP, SMS Twilio) ne bloque jamais la requête principale.

- **Fichiers concernés** :
  - Backend : `backend/services/notification_system_backend.py` (1 209 lignes)
  - Frontend : `Front-end/pfe-project/src/components/NotificationSystem.tsx`
  - Frontend : `Front-end/pfe-project/src/components/NotificationBell.tsx`

- **Nouveaux endpoints** :

| Méthode | Route | Description | Auth/Rôle requis |
|---|---|---|---|
| GET | `/api/notifications/user` | Notifications de l'utilisateur (paginées) | `@token_required` |
| GET | `/api/notifications/unread-count` | Compteur de non-lues | `@token_required` |
| PATCH | `/api/notifications/<id>/read` | Marquer une notification comme lue | `@token_required` |
| PATCH | `/api/notifications/read-all` | Marquer toutes comme lues | `@token_required` |
| DELETE | `/api/notifications/<id>` | Supprimer une notification | `@token_required` |
| GET | `/api/notifications/preferences` | Lire les préférences de notification | `@token_required` |
| PUT | `/api/notifications/preferences` | Mettre à jour les préférences | `@token_required` |
| POST | `/api/notifications/admin/broadcast` | Diffuser une notification à tous les utilisateurs | `@token_required`, `@admin_required` |
| POST | `/api/notifications/test` | Envoyer une notification de test | `@token_required` |
| POST | `/api/notifications/test-email` | Envoyer un email de test | `@token_required` |

- **Données** :
  - **Nouvelle collection `notifications`** :
    ```
    {
      user_id, org_id, title, content, category,
      channels: {in_app, email, sms},
      read: bool, read_at, created_at,
      metadata: {invoice_id, action_url, ...},
      expires_at  // TTL 90 jours
    }
    ```
  - **Nouvelle collection `notification_preferences`** :
    ```
    {
      user_id, org_id,
      channels: {
        in_app: {enabled, categories[]},
        email: {enabled, address, categories[]},
        sms: {enabled, phone, categories[]}
      },
      quiet_hours: {enabled, start, end, timezone},
      updated_at
    }
    ```
  - **Nouvelle collection `notification_templates`** :
    ```
    {
      key, title_template, body_template,
      category, channels[], variables[],
      is_active, created_at
    }
    ```

- **Services externes** : Gmail SMTP (existant), Twilio SMS (existant) — désormais pilotés par le système de préférences

- **Intérêt fonctionnel** : Offre aux utilisateurs un contrôle granulaire sur les canaux et catégories de notifications qu'ils souhaitent recevoir, tout en fournissant aux administrateurs un système de templates et de diffusion centralisé. La persistance MongoDB garantit qu'aucune notification n'est perdue même en cas d'indisponibilité temporaire du client.

---

### [NOUVEAU] Parsing structuré de factures XML

- **Description** : Le module `xml_parser` implémente un analyseur syntaxique dédié aux factures électroniques au format XML, capable de traiter les formats standards de facturation électronique sans recours à l'intelligence artificielle. Le parser extrait de manière déterministe l'ensemble des champs structurés (vendeur, acheteur, lignes de détail, totaux, dates, références) directement depuis l'arbre XML, offrant ainsi une extraction à 100 % de confiance pour les factures conformes aux schémas supportés. Ce module est automatiquement invoqué lorsque le fichier uploadé a l'extension `.xml`, court-circuitant la chaîne LLM.

- **Fichiers concernés** :
  - Backend : `backend/services/xml_parser.py` (510 lignes)
  - Appelé depuis : `backend/services/extractor_core.py` (fonction `extract_from_file`, branche `.xml`)

- **Nouveaux endpoints** : Aucun (intégré au flux d'extraction existant `POST /api/extract-file`)

- **Services externes** : Aucun (bibliothèque Python `lxml`)

- **Intérêt fonctionnel** : Élimine le coût et la latence de l'appel LLM pour les factures déjà structurées au format XML, tout en garantissant une fidélité parfaite de l'extraction. Ce traitement est particulièrement pertinent pour les échanges B2B où les factures sont transmises en XML conforme aux normes tunisiennes.

---

## 4. FONCTIONNALITES MODIFIEES

---

### [MODIFIE] Chaîne de fallback des modèles LLM

- **Avant** : Ollama (LLM local, modèle non spécifié) → Groq (cloud) → Template vide
- **Après** : **Claude API** (Anthropic, modèle `claude-sonnet-4-20250514`) → **Ollama** (modèle `qwen2.5:7b-instruct`) → Template vide
- **Détail du changement** : Groq a été entièrement supprimé du projet (aucune trace dans le code source actuel). L'API Claude d'Anthropic est désormais le moteur d'extraction principal, offrant des capacités de compréhension documentaire supérieures. Ollama est conservé en fallback local avec le modèle Qwen 2.5 7B Instruct. Le client Anthropic est initialisé en singleton (`_anthropic_client`) pour optimiser les connexions.
- **Fichiers** : `backend/services/extractor_core.py`, `backend/config.py`, `backend/requirements.txt` (ajout du package `anthropic`)
- **Impact** : Amélioration significative de la qualité d'extraction, au prix d'une dépendance à une API cloud payante (compensée par le fallback local Ollama).

---

### [MODIFIE] Conseiller IA — Double moteur Claude/Ollama

- **Avant** : Conseiller IA utilisant un seul moteur LLM (non précisé)
- **Après** : Le conseiller financier tente d'abord Claude API (`claude-sonnet-4-20250514`), puis bascule sur Ollama (`qwen2.5:7b-instruct`) en cas d'échec. Le modèle effectivement utilisé est retourné dans la réponse.
- **Fichier** : `backend/app.py` (route `/api/advisor/chat`, lignes 1987-1998)

---

### [MODIFIE] Collection `invoices` — Nouveaux champs

- **Nouveaux champs ajoutés** :
  - `share_code` (string) — code de partage unique INV-XXXXXXXX
  - `imported_from` (string) — code source en cas d'importation
  - `imported_at` (string ISO 8601) — horodatage d'importation
  - `logo` (string Base64) — logo de l'entreprise
  - `signature` (string Base64) — signature manuscrite
  - `invoice_category` (string) — classification goods/services/mixed
  - `category_confidence` (string) — confiance de la classification
  - `service_fields` (array) — métadonnées de service par ligne
  - `compliance` (object) — résultat de validation automatique
  - `signature_validation` (object) — résultat de vérification de signature

---

### [MODIFIE] Collection `organizations` — Nouveau champ

- **Nouveau champ** : `logo_url` (string) — logo/branding de l'organisation

---

### [MODIFIE] Index MongoDB — Nouveaux index

- **Collection `invoices`** : ajout de `idx_org_id`, `idx_org_created` (index composé org_id + created_at)
- **Collection `withholding_certificates`** : 6 index créés — `idx_cert_id` (unique), `idx_cert_user_created`, `idx_cert_org_created`, `idx_cert_status`, `idx_cert_declarant_tax`, `idx_cert_created`
- **Collection `activity_log`** : ajout de `idx_org_timestamp` (index composé org_id + timestamp)

---

### [MODIFIE] Extraction automatique — Post-traitement enrichi

- **Avant** : Extraction IA + OCR + scoring de confiance
- **Après** : Extraction IA + OCR + scoring de confiance + **classification automatique biens/services** + **validation de conformité automatique**
- **Détail** : Après chaque extraction (IA ou XML), le système exécute automatiquement `classify_invoice()` (service_detector) puis `validate_invoice()` (tax_validator), enrichissant le document avec les champs `invoice_category`, `category_confidence`, `service_fields` et `compliance`.
- **Fichier** : `backend/services/extractor_core.py` (lignes 546-555)

---

### [MODIFIE] Dépendances frontend — Nouvelles bibliothèques

- **Ajouts** :
  - `jsqr@1.4.0` — détection de QR codes depuis un élément canvas
  - `qrcode@1.5.4` — génération de QR codes (Node.js)
  - `qrcode.react@4.2.0` — composant React de rendu QR
  - `jspdf@4.0.0` — génération de PDF côté client
  - `react-resizable-panels@4.6.0` — panneaux redimensionnables (pour le split-view)
- **Framework** : Next.js 16.1.6, React 19.2.3, Tailwind CSS 4, Radix UI (40+ composants)

---

## 5. Nouveaux endpoints — Tableau global consolidé

| # | Méthode | Route | Description | Auth | Source |
|---|---|---|---|---|---|
| 1 | GET | `/api/invoices/<id>/qrcode` | Génère QR code PNG | token + org | app.py |
| 2 | GET | `/api/invoices/<id>/qrcode-data` | Payload QR en JSON | token + org | app.py |
| 3 | GET | `/api/invoices/<id>/share-info` | Code de partage + données QR | token + org | app.py |
| 4 | GET | `/api/invoices/lookup/<share_code>` | Recherche par code de partage | token | app.py |
| 5 | POST | `/api/invoices/import/<share_code>` | Import d'une facture partagée | token + org | app.py |
| 6 | POST | `/api/invoices/<id>/verify-signature` | Vérification signature XMLDSig | token + org | app.py |
| 7 | GET | `/api/invoices/<id>/compliance-report` | Rapport de conformité complet | token + org | app.py |
| 8 | GET | `/api/notifications/user` | Notifications utilisateur (paginées) | token | notification_bp |
| 9 | GET | `/api/notifications/unread-count` | Compteur non-lues | token | notification_bp |
| 10 | PATCH | `/api/notifications/<id>/read` | Marquer comme lue | token | notification_bp |
| 11 | PATCH | `/api/notifications/read-all` | Tout marquer comme lu | token | notification_bp |
| 12 | DELETE | `/api/notifications/<id>` | Supprimer notification | token | notification_bp |
| 13 | GET | `/api/notifications/preferences` | Lire préférences | token | notification_bp |
| 14 | PUT | `/api/notifications/preferences` | Modifier préférences | token | notification_bp |
| 15 | POST | `/api/notifications/admin/broadcast` | Diffusion admin | token + admin | notification_bp |

**Total : 15 nouveaux endpoints** (portant le total de ~70 à ~85)

---

## 6. Évolution du modèle de données

### Nouvelles collections (3)

#### `notifications`
```
{
  _id: ObjectId,
  user_id: string,
  org_id: string,
  title: string,
  content: string,
  category: string,           // "extraction", "compliance", "billing", "system"
  channels: {
    in_app: bool,
    email: bool,
    sms: bool
  },
  read: bool,
  read_at: string (ISO 8601),
  created_at: string (ISO 8601),
  metadata: {
    invoice_id: string,
    action_url: string,
    ...
  },
  expires_at: Date            // TTL 90 jours
}
```

#### `notification_preferences`
```
{
  _id: ObjectId,
  user_id: string,
  org_id: string,
  channels: {
    in_app: { enabled: bool, categories: [string] },
    email:  { enabled: bool, address: string, categories: [string] },
    sms:    { enabled: bool, phone: string, categories: [string] }
  },
  quiet_hours: {
    enabled: bool,
    start: string,           // "22:00"
    end: string,             // "08:00"
    timezone: string         // "Africa/Tunis"
  },
  updated_at: string (ISO 8601)
}
```

#### `notification_templates`
```
{
  _id: ObjectId,
  key: string,               // "extraction_complete", "compliance_warning", etc.
  title_template: string,    // "Extraction terminée : {{invoice_no}}"
  body_template: string,     // Template avec variables {{...}}
  category: string,
  channels: [string],        // ["in_app", "email"]
  variables: [string],       // ["invoice_no", "vendor_name", ...]
  is_active: bool,
  created_at: string (ISO 8601)
}
```

### Champs ajoutés aux collections existantes

#### Collection `invoices` (+10 champs)
| Champ | Type | Description |
|---|---|---|
| `share_code` | string | Code unique de partage (INV-XXXXXXXX) |
| `imported_from` | string | Share code de la source (si importée) |
| `imported_at` | string (ISO 8601) | Date d'importation |
| `logo` | string (Base64) | Logo entreprise |
| `signature` | string (Base64) | Signature manuscrite |
| `invoice_category` | string | `"goods"` / `"services"` / `"mixed"` |
| `category_confidence` | string | `"high"` / `"medium"` / `"low"` |
| `service_fields` | array | Métadonnées de service par ligne |
| `compliance` | object | Résultat de validation automatique |
| `signature_validation` | object | Résultat vérification signature |

#### Collection `organizations` (+1 champ)
| Champ | Type | Description |
|---|---|---|
| `logo_url` | string | Logo/branding de l'organisation |

---

## 7. Historique Git récent

### Commits (du plus récent au plus ancien)

| Hash | Message | Fonctionnalités associées |
|---|---|---|
| `5d2251a` | Fix QR code generation — switch to client-side rendering | QR Code (correctif rendu) |
| `2054601` | Add QR code scan & import feature for cross-user invoice sharing | ScanImport, partage QR, import |
| `052a3ba` | Add QR code sharing, logo/signature uploads, and multilingual invoice support | QR sharing, logo/signature, i18n |
| `712a1df` | update project | Mises à jour diverses |
| `51ae021` | Add deployment config and frontend files for Railway hosting | Configuration déploiement |
| `c5370c7` | first commit | Commit initial |
| `9a97cb3` | first commit | Commit initial |
| `5a95985` | first commit | Commit initial |
| `3d0ee0e` | Initial commit — SmartInvoice SaaS | Commit initial du projet |

### Branches

| Branche | Description |
|---|---|
| `main` (active) | Branche principale unique |
| `remotes/origin/main` | Branche distante |

> **Observation** : Le projet ne comporte qu'une seule branche. Les fonctionnalités ont été développées directement sur `main`.

### Correspondance commits ↔ fonctionnalités nouvelles

| Fonctionnalité nouvelle | Commit(s) associé(s) |
|---|---|
| QR code partage + scan + import | `052a3ba`, `2054601`, `5d2251a` |
| Logo & signature upload | `052a3ba` |
| Vérification humaine (InvoiceVerification) | `712a1df` ou antérieur |
| Classification biens/services | `712a1df` ou antérieur |
| Signature numérique XML | `712a1df` ou antérieur |
| Notifications persistantes | `712a1df` ou antérieur |
| Référentiel 129 devises | `052a3ba` |
| Parsing XML structuré | `712a1df` ou antérieur |
| Migration Claude API | `712a1df` ou antérieur |

---

## 8. Diagrammes UML à produire

### 8.1 Nouveaux cas d'utilisation

| Acteur | Cas d'utilisation | Fonctionnalité |
|---|---|---|
| Utilisateur authentifié | Générer un QR code de partage pour une facture | QR Code & Partage |
| Utilisateur authentifié | Scanner un QR code pour importer une facture | Scan & Import |
| Utilisateur authentifié | Saisir manuellement un code de partage | Scan & Import |
| Utilisateur authentifié | Vérifier et corriger les données extraites par l'IA | Vérification humaine |
| Utilisateur authentifié | Consulter le rapport de conformité unifié | Panneau de conformité |
| Utilisateur authentifié | Vérifier la signature numérique d'une facture XML | Signature numérique |
| Utilisateur authentifié | Configurer ses préférences de notification | Notifications persistantes |
| Administrateur | Diffuser une notification à tous les utilisateurs | Notifications (broadcast) |
| Système (automatique) | Classifier une facture en biens/services/mixte | Classification auto |
| Système (automatique) | Parser une facture XML sans IA | Parsing XML |

### 8.2 Diagrammes de séquence à créer

| Intitulé | Acteurs / Composants impliqués |
|---|---|
| Partage de facture par QR code | Utilisateur A → Frontend → API Backend → MongoDB → QR Code PNG → Utilisateur B |
| Scan et import d'une facture | Utilisateur → Caméra/jsQR → ScanImport.tsx → API lookup → API import → MongoDB |
| Vérification humaine post-extraction | Utilisateur → InvoiceVerification.tsx → Split-view → Édition → API PUT → MongoDB |
| Vérification de signature numérique | Utilisateur → CompliancePanel → API verify-signature → signature_validator → X.509 → Résultat |
| Chaîne de fallback LLM (nouvelle) | Upload → extractor_core → Claude API → [échec] → Ollama → [échec] → Template vide |
| Classification automatique biens/services | extractor_core → service_detector → Analyse mots-clés → Analyse durée/taux → Résultat classification |
| Cycle de vie d'une notification | Événement → NotificationService → Template → Préférences → [in-app MongoDB / email SMTP / SMS Twilio] |

### 8.3 Classes/entités à ajouter ou modifier dans le diagramme de classes

#### Nouvelles classes

| Classe | Attributs clés | Méthodes clés |
|---|---|---|
| `SignatureValidator` | — | `validate_xml_signature(raw_xml) → dict` |
| `ServiceDetector` | `_SERVICE_KEYWORDS`, `_GOODS_KEYWORDS`, `_DURATION_PATTERNS` | `classify_invoice(data) → dict`, `_extract_duration(text)`, `_extract_rate(text, total, duration)` |
| `XmlParser` | — | `parse_xml_invoice(content) → dict` |
| `NotificationSystemBackend` | `db`, `smtp_config`, `twilio_config` | `notify()`, `broadcast()`, `get_preferences()`, `update_preferences()` |
| `Notification` (entité) | `user_id`, `title`, `content`, `category`, `channels`, `read`, `expires_at` | — |
| `NotificationPreference` (entité) | `user_id`, `channels`, `quiet_hours` | — |
| `NotificationTemplate` (entité) | `key`, `title_template`, `body_template`, `variables[]` | — |
| `Currency` (entité) | `code`, `symbol`, `name` | — |

#### Classes à modifier

| Classe | Modifications |
|---|---|
| `Invoice` (entité) | Ajouter : `share_code`, `imported_from`, `imported_at`, `logo`, `signature`, `invoice_category`, `category_confidence`, `service_fields`, `compliance`, `signature_validation` |
| `Organization` (entité) | Ajouter : `logo_url` |
| `ExtractorCore` | Modifier la chaîne de fallback : Claude → Ollama → Template (supprimer Groq). Ajouter appels post-extraction : `classify_invoice()`, `validate_invoice()` |

### 8.4 Résumé des diagrammes nécessaires

| Type de diagramme | Nombre à créer/modifier |
|---|---|
| Diagramme de cas d'utilisation | **1 à mettre à jour** (10 nouveaux cas) |
| Diagrammes de séquence | **7 à créer** |
| Diagramme de classes | **1 à mettre à jour** (8 nouvelles classes/entités, 3 modifiées) |
| Diagramme de déploiement | Aucun changement (5 conteneurs inchangés) |
| Diagramme de composants | **1 à mettre à jour** (nouveaux modules backend + composants frontend) |

---

*Fin du document — Généré par analyse exhaustive du code source le 23 mai 2026.*

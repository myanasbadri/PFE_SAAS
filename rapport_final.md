---
title: "SmartInvoice AI — Plateforme SaaS Multi-Tenant de Gestion Intelligente de Factures avec Conformité Fiscale Tunisienne 2026"
author: "Anas Badri"
date: "Année universitaire 2025–2026"
---

<div align="center">

# RÉPUBLIQUE TUNISIENNE
## Ministère de l'Enseignement Supérieur et de la Recherche Scientifique

---

### PROJET DE FIN D'ÉTUDES

*Présenté en vue de l'obtention du diplôme*

---

# SmartInvoice AI

### Plateforme SaaS Multi-Tenant de Gestion Intelligente de Factures avec Conformité Fiscale Tunisienne 2026

---

**Élaboré par :** Anas Badri

**Année universitaire :** 2025 – 2026

---

</div>

<div style="page-break-after: always;"></div>

---

# Table des Matières

- [Résumé Exécutif](#résumé-exécutif)
- [Introduction](#introduction)
- [Chapitre 1 : Contexte et Cadrage du Projet](#chapitre-1--contexte-et-cadrage-du-projet)
  - [1.1 Contexte général](#11-contexte-général)
  - [1.2 Problématique](#12-problématique)
  - [1.3 Objectifs du projet](#13-objectifs-du-projet)
  - [1.4 Périmètre et limites](#14-périmètre-et-limites)
  - [1.5 Méthodologie de travail](#15-méthodologie-de-travail)
- [Chapitre 2 : Exigences et Analyse](#chapitre-2--exigences-et-analyse)
  - [2.1 Identification des acteurs](#21-identification-des-acteurs)
  - [2.2 Exigences fonctionnelles](#22-exigences-fonctionnelles)
  - [2.3 Exigences non fonctionnelles](#23-exigences-non-fonctionnelles)
  - [2.4 Cas d'utilisation](#24-cas-dutilisation)
- [Chapitre 3 : Conception et Architecture](#chapitre-3--conception-et-architecture)
  - [3.1 Architecture globale du système](#31-architecture-globale-du-système)
  - [3.2 Architecture multi-tenant](#32-architecture-multi-tenant)
  - [3.3 Modèle de données](#33-modèle-de-données)
  - [3.4 Patrons de conception](#34-patrons-de-conception)
- [Chapitre 4 : Pile Technologique](#chapitre-4--pile-technologique)
  - [4.1 Technologies front-end](#41-technologies-front-end)
  - [4.2 Technologies back-end](#42-technologies-back-end)
  - [4.3 Base de données et infrastructure](#43-base-de-données-et-infrastructure)
  - [4.4 Services et APIs tiers](#44-services-et-apis-tiers)
  - [4.5 Justification des choix techniques](#45-justification-des-choix-techniques)
- [Chapitre 5 : Implémentation Détaillée](#chapitre-5--implémentation-détaillée)
  - [5.1 Modules back-end](#51-modules-back-end)
  - [5.2 Points de terminaison API](#52-points-de-terminaison-api)
  - [5.3 Pipeline d'extraction intelligente](#53-pipeline-dextraction-intelligente)
  - [5.4 Système de conformité fiscale](#54-système-de-conformité-fiscale)
  - [5.5 Système de notifications](#55-système-de-notifications)
  - [5.6 Authentification et sécurité](#56-authentification-et-sécurité)
- [Chapitre 6 : Interface Utilisateur et UX](#chapitre-6--interface-utilisateur-et-ux)
  - [6.1 Principes de conception](#61-principes-de-conception)
  - [6.2 Flux utilisateur](#62-flux-utilisateur)
  - [6.3 Composants d'interface](#63-composants-dinterface)
  - [6.4 Internationalisation et accessibilité](#64-internationalisation-et-accessibilité)
- [Chapitre 7 : Tests et Qualité](#chapitre-7--tests-et-qualité)
  - [7.1 Stratégie de validation](#71-stratégie-de-validation)
  - [7.2 Mécanismes de fiabilité](#72-mécanismes-de-fiabilité)
  - [7.3 Limitations identifiées](#73-limitations-identifiées)
- [Chapitre 8 : Défis et Solutions](#chapitre-8--défis-et-solutions)
  - [8.1 Défis techniques](#81-défis-techniques)
  - [8.2 Décisions architecturales clés](#82-décisions-architecturales-clés)
  - [8.3 Leçons apprises](#83-leçons-apprises)
- [Chapitre 9 : Résultats et Réalisations](#chapitre-9--résultats-et-réalisations)
  - [9.1 Fonctionnalités livrées](#91-fonctionnalités-livrées)
  - [9.2 Métriques du projet](#92-métriques-du-projet)
  - [9.3 Plans tarifaires](#93-plans-tarifaires)
- [Chapitre 10 : Améliorations Futures](#chapitre-10--améliorations-futures)
  - [10.1 Évolutions planifiées](#101-évolutions-planifiées)
  - [10.2 Considérations de scalabilité](#102-considérations-de-scalabilité)
- [Conclusion](#conclusion)
- [Références et Annexes](#références-et-annexes)

<div style="page-break-after: always;"></div>

---

# Résumé Exécutif

Le présent rapport décrit la conception, le développement et le déploiement de **SmartInvoice AI**, une plateforme SaaS (Software as a Service) de gestion intelligente de factures destinée au marché tunisien. Ce projet de fin d'études répond à un besoin concret des entreprises tunisiennes confrontées à la complexité croissante de la facturation électronique et aux nouvelles exigences réglementaires introduites par la loi de finances 2026 relative à la plateforme nationale TTN El Fatoora.

La solution développée intègre des technologies d'intelligence artificielle — reconnaissance optique de caractères (OCR) et modèles de langage (LLM) — pour automatiser l'extraction de données à partir de factures au format PDF, image ou XML. Elle offre une architecture multi-tenant permettant à plusieurs organisations de coexister sur une même instance tout en garantissant l'isolation complète de leurs données. Le système prend en charge la validation de conformité fiscale selon les normes tunisiennes, la génération de certificats de retenue à la source (TEJ) conformes au schéma XSD 2026.1.0, ainsi qu'un conseiller financier basé sur l'IA.

D'un point de vue technique, le projet mobilise un écosystème moderne articulé autour de **Next.js 16** (React 19, TypeScript) pour le front-end, **Flask** (Python 3.10) pour le back-end, et **MongoDB 7** pour la persistance des données. L'ensemble est orchestré via **Docker Compose** (cinq conteneurs) et déployé sur la plateforme **Railway**. Le projet totalise environ **29 400 lignes de code**, expose plus de **70 points de terminaison API REST**, et propose une interface utilisateur trilingue (anglais, français, arabe avec support RTL) construite à partir de **62 composants React** réutilisables.

Les résultats obtenus démontrent la faisabilité d'une plateforme SaaS complète capable d'automatiser le cycle de vie complet d'une facture — de l'extraction intelligente à la soumission fiscale — tout en offrant une expérience utilisateur fluide et professionnelle. Ce travail constitue une contribution concrète à la digitalisation du tissu économique tunisien dans le contexte de la transition vers la facturation électronique obligatoire.

<div style="page-break-after: always;"></div>

---

# Introduction

## Contexte

La transformation numérique des processus comptables et fiscaux constitue un enjeu stratégique majeur pour les économies émergentes. En Tunisie, l'introduction de la plateforme nationale **TTN El Fatoora** dans le cadre de la loi de finances 2026 impose aux entreprises de toutes tailles une migration vers la facturation électronique. Cette obligation réglementaire engendre des besoins nouveaux en termes d'outils de gestion, de validation et de soumission de factures conformes aux normes nationales.

Parallèlement, les avancées récentes en intelligence artificielle, notamment dans le domaine de la reconnaissance optique de caractères (OCR) et des grands modèles de langage (LLM), ouvrent des perspectives inédites pour l'automatisation du traitement documentaire. La capacité de ces technologies à extraire, structurer et valider des données à partir de documents hétérogènes — factures scannées, fichiers PDF, images photographiées — représente un levier considérable de productivité pour les entreprises.

## Objectifs

Le présent projet de fin d'études vise à concevoir et développer **SmartInvoice AI**, une plateforme SaaS complète répondant aux objectifs suivants : premièrement, automatiser l'extraction de données de factures grâce à l'OCR et à l'intelligence artificielle ; deuxièmement, garantir la conformité fiscale des factures selon les normes tunisiennes 2026 ; troisièmement, proposer une architecture multi-tenant robuste et sécurisée ; quatrièmement, offrir un écosystème complet incluant la gestion d'équipe, la facturation par abonnement, les notifications multi-canal et un conseiller IA ; et enfin, supporter l'internationalisation avec trois langues dont l'arabe en mode RTL.

## Enjeux

Ce projet se situe à la croisée de plusieurs domaines : l'ingénierie logicielle (architecture SaaS, API REST, conteneurisation), l'intelligence artificielle appliquée (OCR, LLM, extraction de données structurées), la conformité réglementaire (fiscalité tunisienne, retenue à la source), et l'expérience utilisateur (design responsive, accessibilité, internationalisation). La réussite de ce projet nécessite une maîtrise transversale de ces domaines, ainsi qu'une capacité à intégrer de manière cohérente des technologies hétérogènes au sein d'une solution unifiée et prête pour la production.

<div style="page-break-after: always;"></div>

---

# Chapitre 1 : Contexte et Cadrage du Projet

## 1.1 Contexte général

Le paysage fiscal tunisien connaît une mutation profonde avec l'introduction progressive de la facturation électronique obligatoire. La plateforme nationale **TTN El Fatoora**, prévue dans le cadre de la loi de finances 2026, impose aux entreprises de soumettre leurs factures dans un format structuré et validé électroniquement. Cette transition affecte l'ensemble du tissu économique, des grandes entreprises aux PME et professions libérales.

Dans ce contexte, les entreprises se trouvent confrontées à plusieurs défis simultanés. D'une part, elles doivent digitaliser leurs processus de facturation existants, souvent basés sur des documents papier ou des fichiers non structurés. D'autre part, elles doivent s'assurer que chaque facture émise ou reçue respecte les exigences de conformité fiscale tunisienne, incluant la validation des matricules fiscaux, le respect des taux de TVA réglementaires (0 %, 7 %, 13 %, 19 %) et l'intégrité arithmétique des montants.

Par ailleurs, la gestion des certificats de retenue à la source (TEJ — Taxe sur les Entreprises et les Jeux) représente une obligation administrative récurrente pour les entreprises tunisiennes. La génération de ces certificats au format XML conforme au schéma national, assortis de déclarations mensuelles, trimestrielles ou annuelles, constitue une charge de travail significative que l'automatisation pourrait considérablement réduire.

## 1.2 Problématique

Comment concevoir et développer une plateforme SaaS capable d'automatiser l'intégralité du cycle de vie d'une facture — de l'extraction intelligente des données à la soumission fiscale — tout en garantissant la conformité aux normes tunisiennes 2026, la sécurité des données dans un environnement multi-tenant, et une expérience utilisateur accessible en trois langues ?

Cette problématique se décline en plusieurs sous-questions techniques : comment exploiter les modèles de langage pour extraire des données structurées à partir de documents hétérogènes avec un niveau de confiance mesurable ? Comment isoler les données de multiples organisations au sein d'une même instance tout en optimisant les ressources ? Comment valider automatiquement la conformité fiscale d'une facture selon un corpus de règles évolutif ?

## 1.3 Objectifs du projet

Le projet SmartInvoice AI poursuit des objectifs à la fois fonctionnels et techniques. Sur le plan fonctionnel, il s'agit de livrer une plateforme opérationnelle permettant l'extraction automatique de données de factures, la gestion CRUD complète avec filtrage avancé, la validation de conformité fiscale, la génération de certificats TEJ, et la mise à disposition d'un conseiller financier basé sur l'IA.

Sur le plan technique, le projet vise à démontrer la maîtrise d'une architecture SaaS moderne incluant le multi-tenancy, l'authentification JWT, le traitement asynchrone via file d'attente de tâches, l'intégration de services tiers (paiement, notifications, LLM), et le déploiement conteneurisé. L'envergure du projet — plus de 29 000 lignes de code et 70 points de terminaison API — témoigne de l'ambition de couvrir un périmètre fonctionnel complet et réaliste.

## 1.4 Périmètre et limites

Le périmètre du projet englobe l'ensemble du cycle de vie de la facture : upload, extraction (OCR + IA), validation, conformité, export et soumission fiscale. Il inclut également les fonctionnalités transverses : gestion multi-organisationnelle, équipe et rôles, facturation par abonnement (Stripe), notifications multi-canal, tableau de bord analytique et internationalisation trilingue.

En revanche, certains aspects restent hors périmètre de cette première version. L'intégration comptable avec des ERP tiers (SAP, Odoo) n'est pas couverte. Le rapprochement bancaire automatique et les workflows d'approbation multi-niveaux sont identifiés comme des améliorations futures. De même, la couverture de tests automatisés (unitaires et d'intégration) reste à développer pour atteindre un niveau de qualité production.

## 1.5 Méthodologie de travail

Le développement du projet a suivi une approche itérative et incrémentale, inspirée des méthodes agiles. Le code source est versionné avec **Git** et hébergé sur **GitHub** (repository : `myanasbadri/PFE_SAAS`). L'utilisation de **Docker Compose** a permis de standardiser l'environnement de développement et de faciliter le déploiement sur la plateforme **Railway**.

La structuration du code en modules indépendants — 18 services back-end et 17 composants métier front-end — a favorisé un développement parallèle et une maintenance aisée. Chaque module encapsule une responsabilité métier précise (authentification, extraction, conformité, notifications, facturation), permettant des itérations ciblées sans risque de régression sur les autres fonctionnalités.

<div style="page-break-after: always;"></div>

---

# Chapitre 2 : Exigences et Analyse

## 2.1 Identification des acteurs

Le système SmartInvoice AI interagit avec cinq catégories d'acteurs ayant des responsabilités et des niveaux d'accès distincts. La modélisation précise de ces acteurs constitue le fondement de l'architecture d'autorisation du système.

| Acteur | Description | Niveau d'accès |
|--------|-------------|----------------|
| **Client** | Utilisateur standard qui gère ses factures au sein d'une organisation | Accès aux fonctionnalités de base : extraction, gestion, export, conseiller IA |
| **Administrateur d'organisation** | Gestionnaire désigné au sein d'une organisation | Gestion des membres, invitations, paramètres d'organisation |
| **Propriétaire d'organisation** | Créateur de l'organisation, responsable de la facturation | Accès complet : suppression, changement de plan, transfert de propriété |
| **Administrateur système** | Gestionnaire global de la plateforme | Administration de tous les utilisateurs, activation/désactivation de comptes |
| **Système externe (TTN)** | Plateforme nationale de facturation électronique | Réception des factures soumises via API |

Cette hiérarchie d'acteurs se traduit techniquement par un système de rôles à deux niveaux : un rôle global (`admin` ou `client`) et un rôle par organisation (`owner`, `admin`, `member`). Les décorateurs Python `@token_required`, `@org_required`, `@org_admin_required` et `@org_owner_required` assurent le contrôle d'accès à chaque point de terminaison.

## 2.2 Exigences fonctionnelles

L'analyse des besoins a permis d'identifier douze groupes d'exigences fonctionnelles couvrant l'ensemble du périmètre applicatif. Le tableau ci-dessous synthétise ces exigences avec leur priorité et leur complexité estimée.

| ID | Exigence fonctionnelle | Priorité | Complexité |
|----|------------------------|----------|------------|
| EF01 | Authentification et inscription (assistant 5 étapes) | Critique | Moyenne |
| EF02 | Multi-tenancy avec gestion des organisations et rôles | Critique | Élevée |
| EF03 | Extraction intelligente de factures (OCR + LLM) | Critique | Élevée |
| EF04 | Gestion CRUD des factures avec filtrage avancé | Critique | Moyenne |
| EF05 | Conformité fiscale tunisienne 2026 (validation, TTN) | Critique | Élevée |
| EF06 | Certificats de retenue à la source TEJ (XML, PDF, QR) | Haute | Élevée |
| EF07 | Conseiller IA financier conversationnel | Haute | Moyenne |
| EF08 | Tableau de bord analytique avec graphiques | Haute | Moyenne |
| EF09 | Notifications multi-canal (in-app, email, SMS, push) | Moyenne | Élevée |
| EF10 | Export de données (Excel individuel et par lot) | Moyenne | Faible |
| EF11 | Facturation et plans d'abonnement (Stripe) | Moyenne | Moyenne |
| EF12 | Internationalisation trilingue (EN, FR, AR + RTL) | Moyenne | Moyenne |

**EF01 — Authentification et inscription.** Le système d'inscription propose un assistant en cinq étapes successives : choix du type d'activité (commercial, service, industriel, libéral, artisanal), sélection du type de personne (physique, morale, non-résident), saisie des informations d'entreprise (optionnel : raison sociale, matricule fiscal, téléphone, adresse), création du compte (nom, email, mot de passe avec confirmation), et enfin une étape de confirmation récapitulative. La connexion repose sur un mécanisme JWT avec expiration à 24 heures. Lors de la première connexion, une organisation personnelle est automatiquement créée pour l'utilisateur.

**EF02 — Multi-tenancy.** L'architecture multi-tenant constitue l'un des piliers du système. Chaque utilisateur peut appartenir à plusieurs organisations simultanément, avec un rôle spécifique dans chacune (propriétaire, administrateur, membre). Le contexte organisationnel est transmis via l'en-tête HTTP `X-Org-Id` à chaque requête, permettant au back-end d'isoler les données en conséquence. Les invitations d'équipe fonctionnent par génération de tokens uniques à durée limitée de sept jours, transmis par email.

**EF03 — Extraction intelligente.** Le module d'extraction constitue le cœur différenciant de la plateforme. Il accepte sept formats de fichiers (PDF, PNG, JPG, JPEG, WebP, TXT, XML) et orchestre un pipeline en plusieurs phases : extraction de texte (OCR Tesseract pour les images, pdfplumber pour les PDF, parsing structuré pour les XML), extraction sémantique par LLM (Ollama en priorité, Groq en fallback), post-traitement automatique (nettoyage des labels, normalisation des dates, correction arithmétique des lignes de facturation), et enfin scoring de confiance par champ. Le traitement par lot avec support des fichiers ZIP et le traitement asynchrone via Celery complètent le dispositif.

**EF05 — Conformité fiscale tunisienne.** Le module de conformité implémente un moteur de règles dédié vérifiant sept catégories de critères : présence des champs obligatoires, format des dates, validité des matricules fiscaux au format tunisien, intégrité des lignes de facturation (quantité × prix unitaire = total), cohérence arithmétique globale (sous-total + taxe − remise = total général), respect des taux de TVA réglementaires (0 %, 7 %, 13 %, 19 %), et validation spécifique aux factures de services. Chaque facture reçoit un score de conformité de 0 à 100 et un statut (conforme, conforme avec avertissements, non conforme).

**EF06 — Certificats TEJ.** La génération de certificats de retenue à la source suit le schéma XSD national version 2026.1.0. Le système prend en charge quatre types de déclarations (mensuelle, trimestrielle, annuelle, complémentaire) et six catégories de retenue (salaires, honoraires, loyers, achats, services non-résidents, commissions). Chaque certificat peut être exporté en PDF avec un QR code de vérification, et le cycle de vie complet est géré (brouillon, soumis, approuvé, rejeté).

## 2.3 Exigences non fonctionnelles

Au-delà des fonctionnalités, le système doit satisfaire des critères transverses de qualité garantissant sa viabilité en production.

| ID | Catégorie | Exigence | Implémentation |
|----|-----------|----------|----------------|
| ENF01 | Performance | Le traitement OCR + IA ne doit pas bloquer l'interface | Celery + Redis (asynchrone) avec fallback synchrone |
| ENF02 | Sécurité | Les mots de passe doivent être stockés de manière irréversible | Hachage bcrypt avec salt automatique |
| ENF03 | Sécurité | Les données de chaque organisation doivent être isolées | Filtrage systématique par `org_id` sur toutes les requêtes |
| ENF04 | Sécurité | Seuls les formats de fichiers autorisés peuvent être uploadés | Whitelist de 7 extensions validées côté serveur |
| ENF05 | Disponibilité | Le système doit redémarrer automatiquement en cas de défaillance | Politique Docker `unless-stopped` sur les 5 conteneurs |
| ENF06 | Scalabilité | Les services doivent pouvoir évoluer indépendamment | Architecture 5 conteneurs Docker indépendants |
| ENF07 | Maintenabilité | Le code doit être modulaire et séparé par responsabilité | 18 modules back-end, 17 composants métier front-end |
| ENF08 | Portabilité | L'application doit pouvoir être déployée sur différentes plateformes | Conteneurisation Docker complète, déploiement Railway |
| ENF09 | Utilisabilité | L'interface doit s'adapter à tous les écrans et langues | Responsive mobile-first, dark/light mode, RTL |
| ENF10 | Fiabilité | Le système doit continuer à fonctionner si un service externe tombe | Fallback LLM (Ollama → Groq → template vide) |
| ENF11 | Conformité | Les données d'audit doivent respecter une durée de rétention | Index TTL de 90 jours sur la collection `activity_log` |

## 2.4 Cas d'utilisation

L'analyse fonctionnelle identifie seize cas d'utilisation principaux répartis entre les différents acteurs du système. Chaque cas d'utilisation a été implémenté comme un flux complet incluant la gestion des erreurs et les notifications associées.

| # | Cas d'utilisation | Acteur principal | Acteurs secondaires |
|---|-------------------|------------------|---------------------|
| UC01 | S'inscrire via l'assistant 5 étapes | Visiteur | Système (création org auto) |
| UC02 | Se connecter / Se déconnecter | Tous | Système (JWT) |
| UC03 | Uploader et extraire des factures | Client | IA (OCR + LLM), Celery |
| UC04 | Gérer ses factures (CRUD + filtrage) | Client | — |
| UC05 | Valider la conformité d'une facture | Client | Moteur de règles |
| UC06 | Générer un certificat TEJ | Client | Générateur XML/PDF |
| UC07 | Consulter le tableau de bord | Client | — |
| UC08 | Discuter avec le conseiller IA | Client | LLM (Ollama/Groq) |
| UC09 | Exporter en Excel ou PDF | Client | — |
| UC10 | Créer et gérer des organisations | Propriétaire | — |
| UC11 | Inviter des membres par email | Admin org | Système (email + token) |
| UC12 | Gérer les rôles des membres | Admin org | — |
| UC13 | Gérer tous les utilisateurs | Admin système | — |
| UC14 | Gérer l'abonnement et la facturation | Propriétaire | Stripe |
| UC15 | Configurer ses préférences de notification | Client | MagicBell |
| UC16 | Soumettre une facture à TTN El Fatoora | Client | TTN (système externe) |

Le cas d'utilisation **UC03 — Extraction de factures** mérite une attention particulière en raison de sa complexité. Le scénario nominal se déroule comme suit : le client sélectionne un ou plusieurs fichiers via l'interface glisser-déposer, le système détecte le type de chaque fichier et engage le pipeline approprié (OCR pour les images, extraction directe pour les PDF, parsing structuré pour les XML). Le traitement est délégué à un worker Celery pour ne pas bloquer l'interface. Une fois l'extraction terminée, le système calcule un score de confiance par champ, détecte automatiquement la catégorie de facture (biens, services, mixte), lance la validation de conformité tunisienne, et notifie l'utilisateur du résultat.

<div style="page-break-after: always;"></div>

---

# Chapitre 3 : Conception et Architecture

## 3.1 Architecture globale du système

SmartInvoice AI repose sur une architecture **client-serveur multi-tiers** avec une séparation stricte entre la couche de présentation, la couche métier et la couche de données. L'ensemble est orchestré via Docker Compose en cinq conteneurs indépendants communicant via un réseau Docker interne.

```
┌─────────────────────────────────────────────────────────────────┐
│                     COUCHE PRÉSENTATION                         │
│                 Next.js 16 (React 19 + TypeScript)              │
│           Tailwind CSS 4 · Shadcn/Radix UI · Recharts           │
│                   Conteneur Docker · Port 3000                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                   REST API (JSON)
              JWT Bearer + X-Org-Id Header
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      COUCHE MÉTIER                               │
│                    Flask (Python 3.10)                            │
│               18 modules de services métier                      │
│                   Conteneur Docker · Port 5000                   │
│                                                                  │
│  ┌──────────────┬────────────────┬────────────────────────────┐  │
│  │ Authentif.   │ Organisations  │ Extraction IA              │  │
│  │ auth_service │ org_service    │ extractor_core             │  │
│  ├──────────────┼────────────────┼────────────────────────────┤  │
│  │ Conformité   │ Notifications  │ Facturation                │  │
│  │ tax_validator│ notification_* │ billing_service            │  │
│  ├──────────────┼────────────────┼────────────────────────────┤  │
│  │ TEJ/XML      │ Export         │ Tâches async               │  │
│  │ teij_xml_gen │ export_service │ celery_worker              │  │
│  └──────────────┴────────────────┴────────────────────────────┘  │
└────────┬──────────────────┬──────────────────┬──────────────────┘
         │                  │                  │
┌────────▼────────┐ ┌──────▼───────┐ ┌────────▼──────────────────┐
│   MongoDB 7     │ │   Redis 7    │ │    Services Externes       │
│   Port 27017    │ │   Port 6379  │ │                            │
│   8 collections │ │  Broker      │ │  Ollama     (LLM local)    │
│   Conteneur     │ │  Celery      │ │  Groq API   (LLM cloud)   │
│   Docker        │ │  Conteneur   │ │  MagicBell  (notifications)│
└─────────────────┘ │  Docker      │ │  Stripe     (paiements)    │
                    └──────────────┘ │  Gmail SMTP (emails)       │
                                     │  Twilio     (SMS)          │
┌─────────────────┐                  │  TTN        (e-factures)   │
│  Celery Worker  │                  └─────────────────────────────┘
│  Conteneur      │
│  Docker         │
│  2 concurrency  │
└─────────────────┘
```

La couche de présentation est construite avec **Next.js 16** exploitant l'App Router et les React Server Components. Elle communique exclusivement avec le back-end via des appels API REST authentifiés par token JWT. L'ensemble des appels est centralisé dans un module unique (`api.ts`) qui gère automatiquement l'injection du token d'authentification et du contexte organisationnel.

La couche métier, implémentée en **Flask**, expose plus de 70 points de terminaison REST et orchestre 18 modules de services spécialisés. Chaque service encapsule une responsabilité métier précise et peut être testé indépendamment. Les traitements longs (extraction OCR + IA) sont délégués à un worker **Celery** connecté à **Redis** comme broker de messages, avec un mécanisme de fallback synchrone en cas d'indisponibilité de la file d'attente.

La couche de données repose sur **MongoDB 7**, une base de données NoSQL orientée documents parfaitement adaptée au stockage de factures dont la structure peut varier significativement d'un fournisseur à l'autre. Huit collections indexées assurent la persistance de l'ensemble des entités métier.

## 3.2 Architecture multi-tenant

Le multi-tenancy constitue un choix architectural structurant qui permet à plusieurs organisations de partager la même instance applicative tout en bénéficiant d'une isolation complète de leurs données. L'implémentation retenue est celle du **multi-tenancy partagé avec discrimination par clé**, où toutes les organisations coexistent dans les mêmes collections MongoDB mais sont filtrées par un identifiant d'organisation (`org_id`).

```
┌────────────────────────────────────────────────────────┐
│                   Requête HTTP                          │
│  Authorization: Bearer <JWT>                            │
│  X-Org-Id: 663a1f2b...                                 │
└──────────────────────┬─────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │ @token_required │  ── Valide le JWT, extrait user_id
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  @org_required  │  ── Vérifie l'appartenance à l'org
              └────────┬────────┘     Définit g.org (contexte global)
                       │
              ┌────────▼────────────────────────────┐
              │  Requête MongoDB filtrée par org_id  │
              │  db.invoices.find({org_id: g.org.id})│
              └─────────────────────────────────────┘
```

Ce mécanisme est renforcé par un système de rôles à deux niveaux. Le rôle global (`admin` ou `client`) détermine l'accès aux fonctionnalités d'administration système. Le rôle organisationnel (`owner`, `admin`, `member`) régit les permissions au sein de chaque organisation. La commutation entre organisations déclenche le renouvellement du token JWT pour y intégrer le nouveau contexte organisationnel.

## 3.3 Modèle de données

Le schéma de données MongoDB est structuré autour de huit collections interreliées. Le choix d'une base NoSQL orientée documents s'explique par la nature hautement variable des factures : selon le fournisseur, le secteur d'activité et le pays, les champs présents, leur format et leur organisation diffèrent considérablement. Le modèle document de MongoDB permet d'accommoder cette variabilité sans migration de schéma.

```
┌──────────────────┐          ┌────────────────────┐
│     users        │          │   organizations    │
│                  │   1:N    │                    │
│ _id              │◄────────►│ _id                │
│ name             │          │ name, slug         │
│ email (unique)   │          │ owner_id ──────────┤──►users._id
│ password (bcrypt)│          │ plan (free/pro/    │
│ role (admin/     │          │       enterprise)  │
│      client)     │          │ stripe_customer_id │
│ is_active        │          │ branding           │
│ profile          │          │ settings           │
│ activity_type    │          │ usage {            │
│ person_type      │          │   invoices/month   │
│ tax_id           │          │   ai_queries/month │
└───────┬──────────┘          │   members_count    │
        │                     │   storage_bytes    │
        │ 1:N                 │ }                  │
        │                     └─────────┬──────────┘
        │                               │
        │    ┌──────────────────┐       │ 1:N
        │    │   memberships   │       │
        │    │                 │◄──────┘
        └───►│ user_id         │
             │ org_id          │
             │ role (owner/    │
             │   admin/member) │
             │ joined_at       │
             └─────────────────┘

┌───────────────────────────────────────────────────────────┐
│                        invoices                            │
│                                                            │
│ _id, user_id, org_id (isolation multi-tenant)              │
│ filename, original_filename, source_format                 │
│ status (processing/completed/failed/reviewed/paid/unpaid)  │
│ data: {                                                    │
│   vendor_name, invoice_no, date, due_date                  │
│   seller_vat_id, buyer_vat_id (matricule fiscal)           │
│   line_items: [{description, qty, unit_price, total,       │
│                  tax_rate, tax_exempt}]                     │
│   totals: {subtotal, tax, discount, grand_total, currency} │
│   bill_to: {name, address, email}                          │
│   field_confidence: {vendor_name: 0-100, ...}              │
│   validation: {is_valid, confidence, needs_human_review}   │
│   compliance: {is_compliant, score, errors, warnings}      │
│ }                                                          │
│ raw_xml, ttn_unique_id, ttn_submitted, signature_validation│
└────────────────────────────────────────────────────────────┘

┌────────────────────┐  ┌────────────────────────────────────┐
│   activity_log     │  │     withholding_certificates       │
│                    │  │                                    │
│ user_id, org_id    │  │ certificate_id (unique)            │
│ action (enum)      │  │ user_id, org_id                    │
│ timestamp          │  │ status (draft/submitted/approved)  │
│ details            │  │ declaration_type                   │
│ ip_address         │  │ period {year, month, quarter}      │
│ TTL: 90 jours      │  │ declarant {tax_id, name, address}  │
└────────────────────┘  │ beneficiaries [{operations[]}]     │
                        │ xml_content, totals, metadata      │
┌────────────────────┐  └────────────────────────────────────┘
│   invitations      │
│                    │  ┌──────────────────────────────────┐
│ org_id, email      │  │ notifications                    │
│ role, token        │  │ notification_preferences         │
│ status, expires_at │  └──────────────────────────────────┘
│ TTL: 7 jours       │
└────────────────────┘
```

L'indexation joue un rôle crucial pour les performances. Des index composés sont définis sur les combinaisons fréquemment interrogées : `(org_id, created_at)` pour le tri chronologique par organisation, `(org_id, status)` pour le filtrage par statut, `(user_id, org_id)` pour la vérification d'appartenance, et `(email)` en index unique pour la collection utilisateurs. Des index TTL (Time-To-Live) assurent le nettoyage automatique des logs d'activité après 90 jours et des invitations expirées après 7 jours.

## 3.4 Patrons de conception

L'architecture du système mobilise plusieurs patrons de conception reconnus, chacun répondant à un besoin structurel spécifique.

| Patron | Application dans le projet | Bénéfice |
|--------|---------------------------|----------|
| **MVC** (Model-View-Controller) | Séparation Vue (Next.js), Contrôleur (routes Flask), Modèle (MongoDB) | Séparation des préoccupations |
| **Strategy** | Extraction LLM : Ollama → Groq → template vide | Interchangeabilité des algorithmes |
| **Observer** | Système de notifications déclenché par événements métier | Couplage lâche entre modules |
| **Decorator** | `@token_required`, `@org_required`, `@check_plan_limit` | Séparation des aspects transverses |
| **Facade** | Module `api.ts` centralisant tous les appels API front-end | Interface simplifiée vers le back-end |
| **Provider** | Context React : AuthProvider, LanguageProvider, ThemeProvider | État global sans prop drilling |
| **Template Method** | Pipeline d'extraction : upload → OCR → IA → post-traitement → validation | Structure de traitement extensible |
| **Builder** | TEJXMLGenerator construit progressivement le document XML | Construction d'objets complexes |

Le patron **Strategy** est particulièrement remarquable dans l'implémentation du module d'extraction. Face à l'instabilité potentielle d'un LLM local (Ollama), le système bascule automatiquement vers un LLM cloud gratuit (Groq), puis vers un template vide en dernier recours. Ce mécanisme de triple fallback garantit que le système reste opérationnel même en cas de défaillance partielle de l'infrastructure IA.

Le patron **Decorator** en Python est utilisé de manière extensive pour les aspects transverses de sécurité. Plutôt que de dupliquer le code de vérification JWT et de contrôle d'accès dans chaque route, les décorateurs `@token_required`, `@org_required`, `@org_admin_required` et `@check_plan_limit` sont composés de manière déclarative sur chaque point de terminaison, assurant une application cohérente des politiques de sécurité.

<div style="page-break-after: always;"></div>

---

# Chapitre 4 : Pile Technologique

## 4.1 Technologies front-end

La couche de présentation repose sur un écosystème React moderne, articulé autour de Next.js 16 comme framework principal. Le choix de l'App Router de Next.js, plutôt que le Pages Router historique, a été motivé par le support des React Server Components, des layouts imbriqués et du streaming, qui améliorent significativement les performances perçues par l'utilisateur.

| Technologie | Version | Rôle |
|-------------|---------|------|
| Next.js | 16.1.6 | Framework React full-stack avec App Router |
| React | 19.2.3 | Bibliothèque de construction d'interfaces utilisateur |
| TypeScript | 5.x | Typage statique pour la robustesse du code |
| Tailwind CSS | 4.0 | Framework CSS utility-first |
| Radix UI | 30+ packages | Primitives d'interface accessibles (WAI-ARIA) |
| Shadcn/UI | — | 45+ composants pré-stylisés sur base Radix |
| Recharts | 3.6.0 | Graphiques interactifs (courbes, camembert, barres) |
| React Hook Form | 7.54.2 | Gestion performante des formulaires |
| Lucide React | 0.562.0 | Bibliothèque de 560+ icônes vectorielles |
| jsPDF | 4.0.0 | Génération de documents PDF côté client |
| React Markdown | 10.1.0 | Rendu Markdown pour le chatbot IA |
| Sonner | 2.0.7 | Notifications toast élégantes |
| next-themes | 0.4.4 | Gestion dark/light mode avec persistance |
| React Dropzone | 14.3.8 | Upload de fichiers par glisser-déposer |

L'interface utilisateur est construite sur le système de design **Shadcn/UI**, qui encapsule les composants primitifs **Radix UI** (conformes aux standards WAI-ARIA d'accessibilité) dans des composants stylisés avec Tailwind CSS. Cette approche offre un contrôle total sur le rendu visuel tout en garantissant l'accessibilité native des interactions (focus, navigation clavier, lecteurs d'écran).

La gestion de l'état applicatif repose sur l'API Context de React, avec trois providers principaux : `AuthProvider` pour l'état d'authentification et le contexte organisationnel, `LanguageProvider` pour l'internationalisation trilingue, et `ThemeProvider` (via next-themes) pour le mode clair/sombre. Ce choix, plutôt qu'une bibliothèque de gestion d'état tierce comme Redux, se justifie par la nature relativement simple de l'état global et par la volonté de minimiser les dépendances.

## 4.2 Technologies back-end

Le back-end est construit sur Flask, un micro-framework Python réputé pour sa flexibilité et sa légèreté. Contrairement à Django qui impose une structure rigide, Flask permet une organisation du code entièrement libre, ce qui s'est avéré crucial pour modulariser les 18 services métier du projet.

| Technologie | Rôle |
|-------------|------|
| Flask + Flask-CORS | Framework web avec gestion des origines croisées |
| Gunicorn | Serveur WSGI production (2 workers, timeout 120s) |
| PyMongo | Driver natif MongoDB pour Python |
| Celery + Redis | File d'attente de tâches asynchrones |
| PyJWT | Génération et validation de tokens JWT (HS256) |
| Bcrypt | Hachage irréversible des mots de passe |
| Pytesseract | Interface Python vers le moteur OCR Tesseract |
| pdfplumber | Extraction de texte haute fidélité depuis les PDF |
| pdf2image + PyMuPDF | Conversion et traitement avancé des PDF |
| Pillow | Traitement et pré-traitement d'images |
| Groq SDK | Client pour l'API LLM Groq (fallback cloud) |
| OpenPyXL | Génération de fichiers Excel (.xlsx) |
| ReportLab | Génération de certificats PDF professionnels |
| qrcode | Génération de QR codes de vérification |
| lxml | Parsing et génération XML haute performance |
| cryptography | Validation de signatures numériques (X.509) |

L'intégration IA repose sur une architecture à double moteur. Le moteur primaire est **Ollama**, un serveur LLM local exécutant le modèle `qwen2.5:7b-instruct`, qui offre l'avantage de la gratuité et de la confidentialité des données (aucune donnée ne quitte le serveur). Le moteur de secours est **Groq**, une API cloud offrant un niveau gratuit généreux avec le modèle `llama-3.3-70b-versatile`. Cette stratégie de double moteur élimine les coûts récurrents d'API tout en garantissant la disponibilité du service d'extraction.

## 4.3 Base de données et infrastructure

L'infrastructure de données repose sur deux moteurs complémentaires. **MongoDB 7** assure la persistance principale des huit collections du système. Son modèle document s'adapte naturellement à la variabilité structurelle des factures, où le nombre de champs, de lignes de facturation et de métadonnées varie considérablement d'un document à l'autre. **Redis 7** (Alpine) sert de broker de messages pour Celery et de couche de cache pour les sessions.

L'environnement d'exécution est entièrement conteneurisé via **Docker Compose**, définissant cinq services interconnectés : MongoDB (persistance), Redis (broker), Flask backend (API), Celery worker (traitement asynchrone, 2 workers concurrents) et Next.js frontend (interface). Un volume Docker nommé (`mongo_data`) assure la persistance des données MongoDB entre les redémarrages.

Le déploiement en production s'effectue sur **Railway**, une plateforme PaaS qui détecte automatiquement les Dockerfiles et configure les builds. Chaque service dispose de son propre fichier `railway.toml` définissant les health checks, les timeouts et la politique de redémarrage automatique (maximum 5 tentatives en cas d'échec).

## 4.4 Services et APIs tiers

Le système s'intègre avec sept services externes, chacun apportant une capacité spécifique non développable en interne dans le cadre du projet.

| Service | Fonction | Modèle économique |
|---------|----------|-------------------|
| **Ollama** | LLM local (qwen2.5:7b-instruct) | Gratuit, open source |
| **Groq API** | LLM cloud fallback (llama-3.3-70b-versatile) | Niveau gratuit généreux |
| **Tesseract OCR** | Reconnaissance optique de caractères (FR + AR) | Gratuit, open source |
| **MagicBell** | Notifications push multi-canal | Freemium |
| **Stripe** | Paiements par carte, abonnements, portail client | Commission par transaction |
| **Gmail SMTP** | Envoi d'emails transactionnels | Gratuit (mot de passe d'application) |
| **Twilio** | SMS (optionnel) | Pay-per-use |

## 4.5 Justification des choix techniques

Chaque choix technologique a été guidé par des critères précis de pertinence pour le contexte du projet.

| Choix | Alternative envisagée | Justification |
|-------|----------------------|---------------|
| MongoDB (NoSQL) | PostgreSQL (SQL) | Schéma flexible pour les factures (champs variables), documents imbriqués, pas de migrations |
| Next.js App Router | Pages Router, Vite+React | React Server Components, layouts imbriqués, optimisation automatique |
| Flask | Django, FastAPI | Légèreté, flexibilité pour API REST pure, écosystème riche |
| Ollama + Groq | OpenAI API | Zéro coût récurrent, confidentialité des données (Ollama local) |
| Celery + Redis | Threading Python, Bull | Robustesse, retry automatique, monitoring des tâches |
| Shadcn/UI | Material UI, Ant Design | Personnalisation totale, taille de bundle réduite, composants Radix accessibles |
| Docker Compose | Kubernetes, déploiement natif | Simplicité d'orchestration adaptée à l'échelle du projet |

<div style="page-break-after: always;"></div>

---

# Chapitre 5 : Implémentation Détaillée

## 5.1 Modules back-end

Le back-end est structuré en 18 modules de services, totalisant environ 11 976 lignes de code Python. Chaque module encapsule une responsabilité métier précise et expose ses fonctionnalités via des fonctions ou des classes dédiées. Le tableau ci-dessous présente chaque module avec sa volumétrie et sa fonction.

| Module | ~Lignes | Responsabilité |
|--------|---------|----------------|
| `app.py` | 2 459 | Application Flask principale, routage de tous les endpoints |
| `notification_system_backend.py` | 1 500 | Orchestration des notifications multi-canal |
| `teij_xml_generator.py` | 1 028 | Génération de certificats TEJ (XML, PDF, QR code) |
| `org_service.py` | 700 | Multi-tenancy, organisations, rôles, invitations |
| `extractor_core.py` | 530 | Pipeline d'extraction OCR + IA |
| `xml_parser.py` | 500 | Parsing XML UBL 2.1 et formats génériques |
| `notification_service.py` | 400 | MagicBell + SMTP + Twilio |
| `tax_validator.py` | 350 | Moteur de validation fiscale tunisienne |
| `billing_service.py` | 325 | Intégration Stripe (checkout, webhooks, portail) |
| `signature_validator.py` | 300 | Vérification de signatures numériques X.509 |
| `export_service.py` | 240 | Génération de fichiers Excel |
| `service_detector.py` | 200 | Classification biens/services/mixte |
| `db_service.py` | 150 | Connexion MongoDB, collections, indexes |
| `auth_service.py` | 100 | JWT (création/validation), bcrypt |
| `celery_worker.py` | 80 | Worker de traitement asynchrone |
| `pdf_service.py` | 80 | Extraction de texte depuis les PDF |
| `plan_limits.py` | 60 | Définition des limites par plan tarifaire |
| `image_service.py` | 50 | OCR Tesseract sur images |

Le fichier `app.py` constitue le point d'entrée de l'application et concentre la définition de tous les endpoints REST. Bien que volumineux (2 459 lignes), il bénéficie d'une organisation interne claire par sections fonctionnelles (authentification, factures, extraction, conformité, TEJ, organisations, administration, export, notifications, conseiller IA) et délègue systématiquement la logique métier aux services spécialisés.

## 5.2 Points de terminaison API

L'API REST expose plus de 70 endpoints organisés en dix groupes fonctionnels. Tous les endpoints (à l'exception de l'inscription, la connexion, les plans publics, le health check et le webhook Stripe) requièrent un token JWT valide. Les endpoints opérant sur des données organisationnelles requièrent en outre le header `X-Org-Id` pour le contexte multi-tenant.

**Authentification** — Trois endpoints fondamentaux gèrent le cycle de vie de l'identité utilisateur. `POST /api/auth/register` accepte les données du formulaire d'inscription en cinq étapes et retourne un token JWT accompagné de l'organisation personnelle auto-créée. `POST /api/auth/login` authentifie par email et mot de passe, retournant le token, le profil utilisateur et la liste des organisations. `GET /api/auth/me` permet au front-end de valider un token existant et de récupérer l'état courant de l'utilisateur.

**Factures** — Huit endpoints couvrent le cycle CRUD complet. L'endpoint `GET /api/invoices` supporte un filtrage avancé par recherche textuelle (regex sur vendor_name, invoice_no, notes, bill_to, filename), par statut, fournisseur, devise, plage de dates, plage de montants, avec tri multi-critères et pagination configurable. L'endpoint `GET /api/invoices/filters` fournit les valeurs uniques de fournisseurs, devises et statuts pour alimenter les composants de filtrage côté client.

**Extraction IA** — `POST /api/extract-file` accepte un fichier unique et retourne soit le résultat d'extraction directe (mode synchrone), soit un identifiant de tâche Celery (mode asynchrone). `POST /api/extract-batch` gère l'upload par lot, incluant l'expansion automatique des fichiers ZIP. `GET /api/tasks/:id` permet le suivi de l'avancement des tâches asynchrones.

**Conformité tunisienne** — Quatre endpoints spécialisés : validation fiscale, vérification de signature numérique, soumission à TTN El Fatoora, et rapport de conformité complet agrégant les trois précédents.

**Certificats TEJ** — Douze endpoints couvrent l'intégralité du cycle de vie des certificats de retenue à la source : consultation des taux de retenue, calcul, génération XML, validation XSD, import CSV par lot, gestion CRUD des certificats, soumission, téléchargement PDF et tableau de bord statistique.

**Organisations** — Douze endpoints pour la gestion multi-tenant : CRUD des organisations, commutation de contexte, gestion des membres et de leurs rôles, envoi et révocation d'invitations, acceptation d'invitation par token.

## 5.3 Pipeline d'extraction intelligente

Le module `extractor_core.py` implémente le pipeline d'extraction de données de factures, qui constitue la fonctionnalité différenciante de la plateforme. Ce pipeline orchestre plusieurs phases de traitement successives.

```
┌───────────────┐
│  Fichier reçu │
└───────┬───────┘
        │
        ▼
┌───────────────────┐     ┌──────────────┐
│ Détection du type │────►│  XML détecté │──► Parsing UBL 2.1 structuré
│ (extension +      │     │              │    (confiance 98%, pas de LLM)
│  contenu)         │     └──────────────┘
└───────┬───────────┘
        │ PDF / Image / TXT
        ▼
┌───────────────────┐
│ Extraction texte  │
│ PDF → pdfplumber  │
│ Image → Tesseract │
│ TXT → lecture     │
└───────┬───────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│            Extraction LLM (Strategy)           │
│                                                │
│  1. Ollama (local, qwen2.5:7b-instruct)       │
│     ↓ échec                                    │
│  2. Groq (cloud, llama-3.3-70b-versatile)      │
│     ↓ échec                                    │
│  3. Template vide (confiance 0%)                │
└───────────────────┬───────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│           Post-traitement automatique          │
│                                                │
│  • _clean_label_word() : suppression labels    │
│    ("Bill To:" → "", "Invoice #" → "")         │
│  • _normalize_date() : conversion → YYYY-MM-DD │
│  • _fix_line_item_quantities() : algèbre       │
│    (si total connu et qty manquant → calcul)   │
│  • _merge_duplicate_line_items() : fusion       │
│    des lignes dupliquées (sous-totaux erronés)  │
│  • Auto-calcul taxe si manquante                │
└───────────────────┬───────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│           Scoring et validation                │
│                                                │
│  • _compute_field_confidence() : score 0-100   │
│    par champ (vendor, invoice_no, date, etc.)  │
│  • _apply_validation_flags() :                 │
│    - is_valid si confiance > 60%               │
│    - needs_human_review si < 3 champs critiques│
│  • service_detector.classify_invoice() :       │
│    catégorisation biens/services/mixte         │
│  • tax_validator.validate_invoice() :          │
│    conformité fiscale tunisienne               │
└───────────────────────────────────────────────┘
```

La fonction `_fix_line_item_quantities()` illustre l'intelligence du post-traitement. Lorsqu'un LLM extrait correctement le total d'une ligne mais omet la quantité ou le prix unitaire, l'algorithme tente de recalculer les valeurs manquantes par résolution algébrique simple. De même, `_merge_duplicate_line_items()` détecte les cas fréquents où le LLM interprète une ligne de sous-total comme une ligne de facturation séparée, et fusionne ces doublons.

## 5.4 Système de conformité fiscale

Le module `tax_validator.py` implémente un moteur de règles dédié à la validation de conformité selon les normes fiscales tunisiennes 2026. Ce moteur effectue sept catégories de vérifications séquentielles, chacune contribuant positivement ou négativement au score de conformité global.

La première catégorie vérifie la présence des champs obligatoires (vendor_name, invoice_no, date, grand_total, line_items, bill_to.name), chaque champ manquant déclenchant une pénalité de 20 points. La deuxième catégorie valide le format des dates (YYYY-MM-DD requis, dates futures interdites). La troisième catégorie vérifie les matricules fiscaux selon le format tunisien. La quatrième catégorie contrôle l'intégrité de chaque ligne de facturation (quantité × prix unitaire = total). La cinquième catégorie effectue la vérification arithmétique globale (sous-total + taxe − remise = total général). La sixième catégorie s'assure que seuls les taux de TVA réglementaires sont appliqués (0 %, 7 %, 13 %, 19 %). La septième catégorie applique des règles spécifiques aux factures de services.

Le résultat de la validation est un objet structuré contenant le statut de conformité (`fully_compliant`, `compliant_with_warnings`, `non_compliant`), le score numérique (0 à 100), les erreurs critiques, les avertissements, les suggestions d'amélioration, et le ratio de vérifications réussies.

Le module `teij_xml_generator.py` (classe `TEJXMLGenerator`, 1 028 lignes) gère la génération de certificats de retenue à la source conformes au schéma XSD 2026.1.0. Il implémente les taux de retenue pour six catégories (salaires, honoraires, loyers, achats, services non-résidents, commissions), prenant en compte le statut du bénéficiaire (personne physique, personne morale, non-résident) et sa catégorie de taux. La méthode `validate_against_schema()` effectue une validation stricte du XML généré contre le schéma XSD embarqué. L'export PDF via ReportLab inclut un emplacement pour signature manuscrite et un QR code de vérification généré dynamiquement.

## 5.5 Système de notifications

L'architecture de notifications de SmartInvoice AI repose sur quatre canaux de distribution complémentaires, orchestrés par deux modules back-end (`notification_service.py` et `notification_system_backend.py`, totalisant environ 1 900 lignes).

Le canal **in-app** stocke les notifications dans une collection MongoDB dédiée et les expose via une API REST paginée. Côté front-end, un composant `NotificationBell` affiche un compteur en temps réel et permet la consultation, le marquage comme lu et la suppression. Le canal **email** utilise Gmail SMTP pour l'envoi de notifications transactionnelles aux utilisateurs concernés et aux administrateurs. Le canal **push** s'appuie sur **MagicBell**, avec une authentification sécurisée par HMAC-SHA256. Le canal **SMS** via Twilio est disponible en option.

Les notifications sont déclenchées par des événements métier : création de facture (`notify_invoice_created`), modification, suppression, changement de statut, extraction terminée ou échouée, besoin de revue humaine, et traitement par lot terminé. Un système de préférences utilisateur permet de contrôler les canaux activés, les heures calmes et la fréquence de digest.

## 5.6 Authentification et sécurité

La sécurité du système repose sur plusieurs couches complémentaires. L'authentification utilise des tokens **JWT** signés avec l'algorithme **HS256** et une expiration de 24 heures. Le payload du token contient l'identifiant utilisateur, l'email, le rôle global, l'identifiant d'organisation courante et le rôle organisationnel. Les mots de passe sont hachés avec **bcrypt**, qui intègre automatiquement un salt aléatoire rendant impossible la reconstitution du mot de passe original.

L'autorisation s'effectue à quatre niveaux via des décorateurs Python composables. Le décorateur `@token_required` valide le JWT et injecte l'utilisateur dans le contexte Flask (`g.user`). Le décorateur `@org_required` vérifie l'appartenance à l'organisation spécifiée par le header `X-Org-Id`. Les décorateurs `@org_admin_required` et `@org_owner_required` ajoutent des vérifications de rôle. Enfin, `@check_plan_limit(resource)` contrôle que l'organisation n'a pas dépassé les quotas de son plan tarifaire.

La sécurité des uploads repose sur une whitelist de sept extensions autorisées (pdf, png, jpg, jpeg, webp, txt, xml) validée côté serveur, et l'utilisation de `werkzeug.secure_filename()` pour prévenir les attaques par traversée de répertoire. La politique CORS est configurable via variables d'environnement, permettant de restreindre les origines autorisées en production.

<div style="page-break-after: always;"></div>

---

# Chapitre 6 : Interface Utilisateur et UX

## 6.1 Principes de conception

L'interface utilisateur de SmartInvoice AI a été conçue selon quatre principes directeurs qui guident l'ensemble des choix de design.

Le premier principe est la **cohérence visuelle**, assurée par l'utilisation systématique du design system Shadcn/UI. Les 45 composants de base (boutons, cartes, dialogues, tableaux, onglets, menus déroulants, etc.) partagent un langage visuel uniforme, une palette de couleurs cohérente articulée autour du vert émeraude (`#10B981`) comme couleur primaire et du bleu profond (`#0A2540`) comme couleur secondaire.

Le deuxième principe est le **responsive design mobile-first**. Toutes les pages s'adaptent aux différentes tailles d'écran grâce aux classes utilitaires Tailwind CSS. La sidebar de navigation (fixe à 256 pixels sur grand écran) se transforme en menu hamburger sur mobile. Le breakpoint principal se situe à `lg:` (1024 pixels).

Le troisième principe est le **feedback constant**. Chaque action utilisateur déclenche un retour visuel immédiat : notifications toast (via Sonner) pour les opérations réussies ou échouées, barres de progression pour les uploads, badges de statut colorés sur les factures, scores de confiance avec code couleur (vert > 80 %, jaune 50-80 %, rouge < 50 %).

Le quatrième principe est l'**accessibilité**. Les composants Radix UI intègrent nativement la gestion du focus, la navigation clavier et les attributs ARIA. Le support du mode sombre (via next-themes) améliore le confort visuel, et le support RTL pour l'arabe garantit une expérience naturelle pour les utilisateurs arabophones.

## 6.2 Flux utilisateur

Le parcours utilisateur principal suit un flux logique conçu pour minimiser la friction et maximiser la productivité.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUX D'INSCRIPTION                            │
│                                                                  │
│  Landing ──► [S'inscrire] ──► Étape 1: Type d'activité          │
│  Page           │              (commercial/service/industriel/   │
│                 │               libéral/artisanal)               │
│                 │                     │                           │
│                 │              Étape 2: Type de personne          │
│                 │              (physique/morale/non-résident)     │
│                 │                     │                           │
│                 │              Étape 3: Info entreprise           │
│                 │              (raison sociale, matricule fiscal) │
│                 │                     │                           │
│                 │              Étape 4: Compte                    │
│                 │              (nom, email, mot de passe)         │
│                 │                     │                           │
│                 │              Étape 5: Confirmation              │
│                 │                     │                           │
│                 └──────────────► Onboarding                      │
│                                  (création org + plan)           │
│                                       │                          │
│                                  Dashboard ◄─────────────────────│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    FLUX PRINCIPAL                                 │
│                                                                  │
│  Dashboard ─┬─► Extraction ──► Upload ──► Pipeline OCR/IA       │
│  (KPIs,     │                            ──► Aperçu données     │
│   graphes,  │                            ──► Sauvegarder        │
│   récents)  │                                                    │
│             ├─► Factures ──► Liste filtrée ──► Détail           │
│             │                 ├── Modifier / Supprimer           │
│             │                 ├── Exporter (Excel/PDF)           │
│             │                 └── Conformité ──► Valider         │
│             │                                    ──► Signature   │
│             │                                    ──► TTN         │
│             │                                                    │
│             ├─► Certificats TEJ ──► Créer / Importer CSV        │
│             │                  ──► Valider ──► Soumettre         │
│             │                                                    │
│             ├─► Conseiller IA ──► Chat conversationnel           │
│             │                                                    │
│             ├─► Activité ──► Journal audité avec filtres         │
│             │                                                    │
│             ├─► Équipe ──► Membres + Invitations                 │
│             │                                                    │
│             ├─► Paramètres ──► Organisation + Facturation        │
│             │                                                    │
│             └─► Notifications ──► Centre + Préférences           │
└─────────────────────────────────────────────────────────────────┘
```

## 6.3 Composants d'interface

L'interface est structurée en 17 composants métier majeurs, chacun encapsulant une page ou une fonctionnalité complète de l'application.

**Dashboard** — Le tableau de bord constitue la page d'accueil après connexion. Il présente quatre indicateurs clés de performance (KPI) : le montant total des factures, le nombre total de factures, le nombre de factures nécessitant une revue humaine, et la valeur moyenne par facture. Trois graphiques interactifs (construits avec Recharts) complètent la vue : un graphique en courbe pour la tendance mensuelle des montants, un graphique en camembert pour la répartition par fournisseur, et un graphique en barres pour la répartition par statut. Un tableau des cinq factures les plus récentes permet un accès rapide aux derniers documents.

**AIExtraction** — Le composant d'extraction constitue l'interface la plus complexe de l'application. Il propose une zone de glisser-déposer acceptant les fichiers individuels ou les archives ZIP. Lors de l'extraction, un indicateur en quatre étapes suit le progression du pipeline (upload, OCR, extraction IA, validation). Les résultats sont présentés sous forme de champs extraits avec un code couleur de confiance par champ. L'utilisateur peut corriger les valeurs avant de sauvegarder la facture. Le mode batch affiche une file d'attente avec le statut de chaque fichier.

**InvoiceManagement** — La gestion des factures offre un tableau paginé avec des capacités de filtrage avancé : recherche textuelle, filtres par statut, fournisseur, devise, plage de dates et plage de montants. Chaque facture affiche un badge de format source (PDF, image, XML) et un badge de conformité (vert, orange, rouge). Les actions disponibles incluent la visualisation détaillée, la modification via dialogue modal, la suppression avec confirmation, l'export individuel en Excel ou PDF, la consultation de l'historique des modifications et le lancement de la vérification de conformité.

**AIAdvisor** — Le conseiller IA se présente sous la forme d'une interface de chat conversationnel. Les messages utilisateur apparaissent alignés à droite et les réponses de l'assistant à gauche, avec rendu Markdown pour les tableaux et listes. Six questions suggérées facilitent la prise en main : tendances de dépenses, principaux fournisseurs, optimisation des coûts, factures nécessitant une revue, résumé mensuel et santé financière. Le contexte de conversation inclut automatiquement les 200 factures les plus récentes de l'organisation pour des réponses contextualisées.

**WithholdingTax** — Le module TEJ propose un formulaire complet de création de certificats de retenue à la source, avec sélection du type de déclaration, de la période, des informations du déclarant et des bénéficiaires avec leurs opérations. Un tableau de bord dédié affiche les KPIs (montant brut total, retenue totale, montant net, nombre d'opérations) et des graphiques de répartition par statut et par type. L'import par lot via CSV permet de traiter de grands volumes.

## 6.4 Internationalisation et accessibilité

Le système d'internationalisation de SmartInvoice AI repose sur le module `LanguageContext.tsx` qui implémente un dictionnaire statique de plus de **1 400 clés de traduction** couvrant trois langues : anglais, français et arabe. Le choix d'un dictionnaire statique plutôt qu'une bibliothèque i18n tierce (comme next-intl ou react-i18next) a été motivé par la simplicité et l'absence de dépendance supplémentaire.

La fonction de traduction `t(key)` effectue une recherche dans le dictionnaire de la langue courante et retourne la clé brute si aucune traduction n'est trouvée, facilitant le développement itératif. Le support RTL (right-to-left) pour l'arabe est activé automatiquement lors du changement de langue : `document.dir` est basculé en `'rtl'` et `document.lang` est mis à jour, ce qui déclenche l'inversion automatique de la mise en page grâce aux propriétés CSS logiques et aux classes utilitaires Tailwind.

Les traductions couvrent l'intégralité de l'interface : navigation, dashboard, factures, extraction, conseiller IA, journal d'activité, notifications, gestion d'équipe, paramètres, administration, terminologie de conformité tunisienne (e-facturation TTN), terminologie TEJ (retenue à la source), et l'assistant d'inscription en cinq étapes.

<div style="page-break-after: always;"></div>

---

# Chapitre 7 : Tests et Qualité

## 7.1 Stratégie de validation

La stratégie de validation de SmartInvoice AI repose sur plusieurs mécanismes complémentaires visant à garantir la qualité et la fiabilité du système, en l'absence d'une suite de tests automatisés formelle.

Au niveau de la **base de données**, des validateurs JSON Schema sont appliqués au niveau modéré sur les collections MongoDB. Ces validateurs contrôlent la structure des documents insérés, rejetant les entrées ne respectant pas le schéma attendu. Cette approche constitue une première ligne de défense contre les données malformées.

Au niveau du **front-end**, le compilateur **TypeScript** en mode strict (`"strict": true` dans tsconfig.json) assure une vérification de type exhaustive à la compilation. Toutes les interfaces de données sont définies explicitement (Invoice, AuthUser, Org, TEJCertificate, ComplianceResult, etc.), ce qui élimine les erreurs de type à l'exécution. L'analyseur statique **ESLint** avec la configuration Next.js complète cette couverture en détectant les problèmes de qualité de code, les imports inutilisés et les violations des bonnes pratiques React.

Au niveau de l'**extraction IA**, un système de scoring de confiance par champ (0 à 100 %) permet d'évaluer la qualité de chaque extraction. Les champs avec un score inférieur à 50 % sont signalés visuellement en rouge, et le flag `needs_human_review` est activé automatiquement lorsque la confiance globale est inférieure à 60 % ou que moins de trois champs critiques ont été identifiés. Ce mécanisme transforme l'incertitude inhérente à l'extraction IA en information actionnable pour l'utilisateur.

Au niveau de la **conformité fiscale**, le moteur de validation `tax_validator.py` effectue sept catégories de vérifications formelles sur chaque facture, produisant un rapport détaillé avec score, erreurs, avertissements et suggestions. Ce module constitue en lui-même un ensemble de tests métier appliqués automatiquement à chaque facture traitée.

## 7.2 Mécanismes de fiabilité

Le système implémente plusieurs mécanismes de résilience pour maintenir la disponibilité du service face aux défaillances partielles.

| Mécanisme | Scénario de défaillance | Comportement de repli |
|-----------|------------------------|----------------------|
| Fallback LLM triple | Ollama local indisponible | Bascule vers Groq API cloud |
| Fallback LLM ultime | Groq API également indisponible | Retour d'un template vide avec confiance 0 % |
| Fallback synchrone | Celery/Redis indisponible | Traitement synchrone dans le thread principal |
| Health check | Conteneur en échec | Redémarrage automatique (politique Docker) |
| TTL Activity | Accumulation de logs | Suppression automatique après 90 jours |
| TTL Invitations | Invitations non acceptées | Expiration automatique après 7 jours |
| Secure filename | Tentative de traversée de répertoire | Nettoyage automatique par werkzeug |
| CORS configurable | Requêtes d'origines non autorisées | Rejet automatique |

Le mécanisme de fallback LLM mérite une attention particulière. La fonction `extract_invoice_fields()` dans `extractor_core.py` encapsule la logique de bascule : elle tente d'abord l'extraction via Ollama (gratuit, local, rapide), puis via Groq (gratuit, cloud, fiable), et enfin retourne un template vide avec des scores de confiance à zéro. À aucun moment le système ne lève d'exception non gérée vers l'utilisateur — le pire scénario est une extraction vide que l'utilisateur peut compléter manuellement.

## 7.3 Limitations identifiées

En toute transparence, le projet présente certaines limitations qui constituent des axes d'amélioration pour les versions futures.

L'absence de **tests automatisés formels** (pytest pour le back-end, Jest/React Testing Library pour le front-end) constitue la limitation la plus significative. Bien que la compilation TypeScript et les validateurs MongoDB offrent un premier niveau de vérification, une couverture de tests unitaires et d'intégration serait nécessaire pour garantir la non-régression lors des évolutions futures.

La **précision de l'OCR** dépend fortement de la qualité du document source. Les factures scannées à basse résolution, les images photographiées avec un angle oblique ou les documents contenant des fonds colorés peuvent réduire significativement la qualité de l'extraction. Le post-traitement par LLM atténue partiellement ce problème, mais ne peut compenser un texte illisible au niveau OCR.

La **variabilité des LLM** constitue une limitation inhérente à l'approche. Selon la langue de la facture, le format du fournisseur et la complexité du document, la qualité de l'extraction peut varier. Le mécanisme de scoring de confiance et le flag de revue humaine permettent de gérer cette incertitude de manière transparente.

<div style="page-break-after: always;"></div>

---

# Chapitre 8 : Défis et Solutions

## 8.1 Défis techniques

Le développement de SmartInvoice AI a été jalonné de défis techniques significatifs, chacun ayant nécessité une solution d'ingénierie spécifique.

**Défi 1 : Extraction de données structurées à partir de texte libre.** L'OCR produit un flux de texte non structuré, et les factures de différents fournisseurs présentent des mises en page, des terminologies et des formats radicalement différents. La solution retenue combine un prompt engineering soigné (template JSON strict fourni au LLM) avec un pipeline de post-traitement en quatre étapes : nettoyage des labels résiduels (`_clean_label_word`), normalisation des dates vers le format ISO (`_normalize_date`), correction algébrique des quantités manquantes (`_fix_line_item_quantities`), et fusion des lignes de sous-totaux incorrectement extraites (`_merge_duplicate_line_items`). Ce post-traitement automatique améliore significativement la qualité des résultats sans intervention humaine.

**Défi 2 : Fiabilité du service LLM.** Un LLM local (Ollama) peut être indisponible pour de multiples raisons : GPU occupé, modèle non chargé, service arrêté. La solution d'architecture Strategy avec triple fallback (Ollama → Groq → template vide) garantit que le système reste toujours opérationnel, avec une dégradation gracieuse de la qualité d'extraction plutôt qu'une erreur bloquante.

**Défi 3 : Isolation des données multi-tenant.** Assurer qu'aucune fuite de données ne se produise entre organisations dans une base de données partagée exige une rigueur systématique. La solution repose sur le décorateur `@org_required` appliqué à chaque endpoint sensible, qui injecte automatiquement le contexte organisationnel dans les requêtes MongoDB. L'index composé `(org_id, created_at)` sur la collection invoices garantit à la fois l'isolation et la performance des requêtes filtrées.

**Défi 4 : Conformité fiscale tunisienne.** Les règles fiscales tunisiennes sont complexes et évolutives. Le moteur de validation a été conçu comme un ensemble de vérifications modulaires et extensibles, où chaque catégorie de règle est implémentée comme une fonction indépendante. Cette approche facilite l'ajout de nouvelles règles sans modification des règles existantes, conformément au principe ouvert/fermé (Open/Closed Principle).

**Défi 5 : Génération de certificats TEJ conformes.** Le schéma XSD 2026.1.0 impose une structure XML stricte avec de nombreuses contraintes de format, de cardinalité et de cohérence. La solution a consisté à embarquer le schéma XSD dans le générateur et à effectuer une validation systématique du XML produit via `lxml.etree.XMLSchema`. L'export PDF intègre un QR code de vérification généré dynamiquement avec l'URL de validation et le hash du certificat.

**Défi 6 : Internationalisation avec RTL.** Le support de l'arabe nécessite non seulement la traduction des textes mais aussi l'inversion de l'ensemble de la mise en page (droite-à-gauche). Grâce à l'utilisation de propriétés CSS logiques (margin-inline-start plutôt que margin-left) et à la directive `document.dir = 'rtl'`, l'inversion s'effectue automatiquement sans duplication des styles.

## 8.2 Décisions architecturales clés

Certaines décisions architecturales ont eu un impact déterminant sur la réussite du projet. Le choix de **MongoDB** plutôt qu'une base relationnelle a permis de gérer naturellement la variabilité des factures sans migration de schéma. Le choix d'**Ollama + Groq** plutôt qu'OpenAI a éliminé les coûts récurrents d'API tout en offrant une qualité d'extraction comparable. Le choix de **Celery + Redis** plutôt que du threading Python simple a apporté la robustesse nécessaire pour le traitement asynchrone (retry, monitoring, scaling horizontal des workers).

Le choix de **Shadcn/UI** plutôt qu'une bibliothèque de composants monolithique (Material UI, Ant Design) a permis un contrôle total sur le rendu visuel et la taille du bundle, tout en conservant l'accessibilité native des primitives Radix. Le choix de **Docker Compose** plutôt que Kubernetes représente un compromis pragmatique entre l'orchestration et la complexité, adapté à l'échelle du projet.

## 8.3 Leçons apprises

Le développement de ce projet a permis de tirer plusieurs enseignements importants. Premièrement, la qualité de l'extraction IA dépend autant du post-traitement que du modèle lui-même : un LLM performant avec un mauvais post-traitement produit des résultats moins exploitables qu'un LLM moyen avec un excellent post-traitement. Deuxièmement, l'architecture de fallback s'est avérée indispensable en pratique : lors du développement, le LLM local a été indisponible à de nombreuses reprises, et le fallback vers Groq a permis de poursuivre le travail sans interruption. Troisièmement, la modularisation rigoureuse du code en services indépendants a considérablement facilité le développement itératif et le débogage.

<div style="page-break-after: always;"></div>

---

# Chapitre 9 : Résultats et Réalisations

## 9.1 Fonctionnalités livrées

L'ensemble des fonctionnalités prévues dans le cahier des charges a été implémenté et intégré dans une plateforme opérationnelle. Le tableau ci-dessous récapitule les fonctionnalités livrées avec leur niveau de maturité.

| Fonctionnalité | Statut | Maturité |
|----------------|--------|----------|
| Authentification avec inscription assistant 5 étapes | Livré | Production |
| Multi-tenancy avec organisations, rôles et invitations | Livré | Production |
| Extraction IA de factures (PDF, images, XML, TXT) | Livré | Production |
| Traitement par lot avec support ZIP | Livré | Production |
| Gestion CRUD des factures avec filtrage avancé | Livré | Production |
| Validation de conformité fiscale tunisienne 2026 | Livré | Production |
| Vérification de signatures numériques XML | Livré | Production |
| Génération de certificats TEJ (XML + PDF + QR code) | Livré | Production |
| Conseiller IA financier conversationnel | Livré | Production |
| Tableau de bord analytique avec graphiques interactifs | Livré | Production |
| Notifications multi-canal (in-app, email, SMS, push) | Livré | Production |
| Export Excel (individuel et par lot) | Livré | Production |
| Intégration Stripe (plans, checkout, portail client) | Livré | Production |
| Gestion d'équipe avec invitations par email | Livré | Production |
| Internationalisation (EN, FR, AR + RTL) | Livré | Production |
| Dark/Light mode | Livré | Production |
| Déploiement Docker Compose + Railway | Livré | Production |

## 9.2 Métriques du projet

Les métriques quantitatives du projet témoignent de son envergure et de sa complétude.

| Catégorie | Métrique | Valeur |
|-----------|----------|--------|
| **Code** | Lignes de code totales | ~29 400 |
| | Fichiers Python (.py) | 25 |
| | Fichiers TypeScript/React (.tsx) | 133 |
| | Modules de services back-end | 18 |
| | Composants React (UI + métier) | 62+ |
| **API** | Points de terminaison REST | 70+ |
| | Collections MongoDB | 8 |
| **i18n** | Langues supportées | 3 (EN, FR, AR) |
| | Clés de traduction | 1 400+ |
| **Intégrations** | Services externes | 7 |
| | Canaux de notification | 4 |
| **Infrastructure** | Conteneurs Docker | 5 |
| | Formats de fichiers supportés | 7 |
| **Conformité** | Catégories de vérification fiscale | 7 |
| | Types de retenue TEJ | 6 |
| | Taux de TVA validés | 4 |

## 9.3 Plans tarifaires

Le modèle économique de SmartInvoice AI repose sur trois plans d'abonnement définis dans le module `plan_limits.py` et intégrés à Stripe pour la gestion des paiements.

| Caractéristique | Free | Pro | Enterprise |
|-----------------|------|-----|------------|
| **Prix mensuel** | 0 $ | 29 $ | 99 $ |
| **Prix annuel** | 0 $ | 290 $ | 990 $ |
| **Factures / mois** | 50 | 500 | Illimité |
| **Membres** | 3 | 15 | Illimité |
| **Requêtes IA / mois** | 20 | 200 | Illimité |
| **Stockage** | 100 Mo | 5 Go | Illimité |
| **Extraction IA** | Basique | Avancée + Batch | Complète |
| **Conseiller IA** | — | Inclus | Inclus |
| **Export Excel** | — | Inclus | Inclus |
| **Support** | Communauté | Prioritaire | Dédié |

Ce modèle freemium permet aux petites entreprises et indépendants de découvrir la plateforme sans engagement, tout en offrant des capacités étendues aux organisations plus importantes. Les limites d'utilisation sont contrôlées en temps réel par le décorateur `@check_plan_limit` qui vérifie les compteurs d'usage de l'organisation avant chaque opération consommatrice.

<div style="page-break-after: always;"></div>

---

# Chapitre 10 : Améliorations Futures

## 10.1 Évolutions planifiées

Le projet SmartInvoice AI a été conçu avec une architecture extensible permettant l'ajout progressif de fonctionnalités. Les évolutions planifiées sont classées par priorité selon leur impact sur la valeur délivrée aux utilisateurs.

À **haute priorité**, l'ajout d'une couverture de tests automatisés constitue le chantier le plus urgent. L'implémentation de tests unitaires avec **pytest** pour le back-end (couvrant les services d'extraction, de validation fiscale et de génération TEJ) et de tests d'intégration avec **Jest** et **React Testing Library** pour le front-end garantirait la non-régression lors des évolutions futures. Un pipeline CI/CD (GitHub Actions) automatiserait l'exécution de ces tests à chaque push.

Toujours à haute priorité, l'implémentation de **WebSockets** pour les mises à jour en temps réel du tableau de bord et des notifications transformerait l'expérience utilisateur. Actuellement, les données sont rafraîchies lors du chargement de page ; des mises à jour en temps réel rendraient le tableau de bord véritablement interactif et permettraient des notifications instantanées sans polling.

À **moyenne priorité**, le fine-tuning d'un modèle LLM spécialisé sur les factures tunisiennes améliorerait significativement la précision de l'extraction pour les formats locaux. L'entraînement sur un corpus de factures tunisiennes (bilingues français-arabe, avec les formats spécifiques de matricule fiscal et de mise en page) permettrait d'atteindre des scores de confiance plus élevés sans post-traitement intensif.

L'extension à une **application mobile** (React Native ou Progressive Web App) permettrait aux comptables et entrepreneurs de photographier et soumettre des factures directement depuis leur téléphone. Le rapprochement bancaire automatique, permettant de matcher les factures avec les relevés bancaires, constitue également une évolution de moyenne priorité à forte valeur ajoutée.

À **plus long terme**, l'ouverture d'une **API publique** documentée avec OpenAPI/Swagger permettrait l'intégration avec des systèmes ERP tiers (SAP, Odoo, Sage). L'ajout de workflows d'approbation multi-niveaux (validation managériale avant paiement) et l'extension à d'autres régimes fiscaux (Maroc, Algérie) élargirait le marché adressable de la plateforme.

## 10.2 Considérations de scalabilité

L'architecture actuelle, bien que fonctionnelle, pourrait bénéficier de plusieurs optimisations en vue d'un passage à l'échelle.

| Composant | Amélioration | Impact attendu |
|-----------|-------------|----------------|
| MongoDB | Migration vers MongoDB Atlas avec replica set | Haute disponibilité, sauvegardes automatiques |
| Celery Workers | Scaling horizontal (augmentation du nombre de workers) | Débit de traitement multiplié |
| Front-end | CDN pour les assets statiques, Incremental Static Regeneration | Temps de chargement réduit |
| Cache | Mise en cache Redis des requêtes fréquentes (stats, filtres) | Réduction de la charge MongoDB |
| Monitoring | Ajout Prometheus + Grafana | Visibilité sur les performances |
| Load Balancing | Nginx reverse proxy devant les workers Gunicorn | Distribution de charge, SSL termination |

Le passage de 5 à 50 organisations actives nécessiterait principalement le scaling horizontal des workers Celery et l'ajout d'un cache Redis pour les requêtes de dashboard. Le passage à 500+ organisations nécessiterait une migration vers MongoDB Atlas avec sharding et la mise en place d'un CDN pour le front-end.

<div style="page-break-after: always;"></div>

---

# Conclusion

Le projet **SmartInvoice AI** représente l'aboutissement d'un travail de conception et de développement ambitieux, couvrant l'intégralité du cycle de vie d'une facture dans le contexte réglementaire tunisien 2026. Avec ses quelque 29 400 lignes de code, ses 70 points de terminaison API, ses 62 composants React et ses 18 modules de services back-end, la plateforme livrée dépasse le cadre d'un prototype académique pour constituer une solution opérationnelle prête pour une utilisation réelle.

Sur le plan technique, ce projet a permis de démontrer la faisabilité d'une intégration harmonieuse entre intelligence artificielle (OCR + LLM), architecture SaaS multi-tenant, conformité réglementaire et expérience utilisateur multilingue. L'architecture de fallback triple pour les LLM, le pipeline de post-traitement de l'extraction, et le moteur de validation fiscale constituent des contributions techniques significatives répondant à des problématiques concrètes du domaine.

Sur le plan métier, SmartInvoice AI apporte une réponse directe aux besoins des entreprises tunisiennes confrontées à la transition vers la facturation électronique obligatoire. L'automatisation de l'extraction de données, la validation de conformité et la génération de certificats TEJ réduisent significativement la charge administrative tout en minimisant le risque d'erreurs de conformité.

Sur le plan personnel, ce projet a constitué une expérience d'apprentissage intense et multidimensionnelle, couvrant des domaines aussi variés que le prompt engineering pour l'extraction de données, la conception d'architectures multi-tenant, l'intégration de services de paiement, la génération de documents XML/PDF conformes à des schémas normatifs, et l'internationalisation avec support RTL. La confrontation avec les contraintes réelles — variabilité des documents, instabilité des services LLM, complexité des règles fiscales — a développé une capacité d'adaptation et de résolution de problèmes directement transférable au monde professionnel.

En définitive, SmartInvoice AI illustre comment les technologies modernes — intelligence artificielle, cloud computing, architectures SaaS — peuvent être mobilisées au service de la digitalisation des processus économiques dans un pays en pleine transition numérique. Les améliorations futures identifiées — tests automatisés, temps réel, application mobile, extension régionale — tracent la voie vers une plateforme complète pouvant accompagner durablement les entreprises tunisiennes dans leur conformité fiscale.

<div style="page-break-after: always;"></div>

---

# Références et Annexes

## Références bibliographiques et techniques

**Frameworks et bibliothèques :**

1. Next.js Documentation — nextjs.org/docs — Framework React pour la production
2. Flask Documentation — flask.palletsprojects.com — Micro-framework web Python
3. MongoDB Documentation — docs.mongodb.com — Base de données NoSQL orientée documents
4. Celery Documentation — docs.celeryq.dev — File d'attente de tâches distribuées
5. Tailwind CSS Documentation — tailwindcss.com/docs — Framework CSS utility-first
6. Radix UI Documentation — radix-ui.com — Primitives d'interface accessibles
7. Shadcn/UI Documentation — ui.shadcn.com — Composants React réutilisables

**Intelligence artificielle et OCR :**

8. Tesseract OCR — github.com/tesseract-ocr — Moteur OCR open source
9. Ollama — ollama.ai — Serveur LLM local
10. Groq — groq.com — Inférence LLM haute performance

**Services tiers :**

11. Stripe Documentation — stripe.com/docs — Plateforme de paiement en ligne
12. MagicBell Documentation — magicbell.com/docs — Notifications multi-canal
13. Railway Documentation — docs.railway.app — Plateforme de déploiement cloud

**Normes et réglementations :**

14. Loi de finances 2026 — République Tunisienne — Dispositions relatives à la facturation électronique
15. Plateforme TTN El Fatoora — Système national de facturation électronique
16. Schéma XSD TEJ 2026.1.0 — Format des certificats de retenue à la source

## Annexe A : Variables d'environnement

| Variable | Obligatoire | Description |
|----------|:-----------:|-------------|
| `MONGO_URI` | Oui | URI de connexion MongoDB |
| `DB_NAME` | Oui | Nom de la base de données (défaut : `invoice_ai`) |
| `JWT_SECRET` | Oui | Clé secrète pour la signature des tokens JWT |
| `GROQ_API_KEY` | Recommandé | Clé API Groq pour le LLM de fallback |
| `OLLAMA_URL` | Non | URL du serveur Ollama local (défaut : `http://localhost:11434`) |
| `OLLAMA_MODEL` | Non | Modèle Ollama (défaut : `qwen2.5:7b-instruct`) |
| `MAGICBELL_API_KEY` | Non | Clé API MagicBell pour les notifications push |
| `MAGICBELL_API_SECRET` | Non | Secret API MagicBell pour l'authentification HMAC |
| `SMTP_EMAIL` | Non | Adresse Gmail pour l'envoi d'emails |
| `SMTP_PASSWORD` | Non | Mot de passe d'application Gmail |
| `STRIPE_SECRET_KEY` | Non | Clé secrète Stripe pour les paiements |
| `STRIPE_WEBHOOK_SECRET` | Non | Secret de vérification des webhooks Stripe |
| `CELERY_BROKER_URL` | Non | URL Redis pour le broker Celery |
| `NEXT_PUBLIC_API_URL` | Oui (front) | URL du back-end (défaut : `http://localhost:5000`) |

## Annexe B : Instructions d'installation

**Installation avec Docker Compose (recommandée) :**

```bash
# 1. Cloner le repository
git clone https://github.com/myanasbadri/PFE_SAAS.git
cd PFE_SAAS

# 2. Configurer les variables d'environnement
cp .env.docker .env
# Éditer .env avec les clés API nécessaires

# 3. Lancer tous les services
docker-compose up -d

# 4. Accéder à l'application
# Frontend  : http://localhost:3000
# Backend   : http://localhost:5000
# MongoDB   : localhost:27017
# Redis     : localhost:6379
```

**Installation locale (développement) :**

```bash
# Back-end
cd backend
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows
pip install -r requirements.txt
cp .env.example .env
python app.py

# Front-end (dans un second terminal)
cd Front-end/pfe-project
npm install
cp .env.example .env.local
npm run dev
```

## Annexe C : Inventaire complet des endpoints API

| # | Méthode | Chemin | Auth | Org | Description |
|---|---------|--------|:----:|:---:|-------------|
| 1 | GET | `/api/health` | — | — | Vérification de santé |
| 2 | POST | `/api/auth/register` | — | — | Inscription utilisateur |
| 3 | POST | `/api/auth/login` | — | — | Connexion |
| 4 | GET | `/api/auth/me` | JWT | — | Profil courant |
| 5 | POST | `/api/extract-file` | JWT | Org | Extraction fichier unique |
| 6 | POST | `/api/extract-batch` | JWT | Org | Extraction par lot |
| 7 | GET | `/api/tasks/:id` | JWT | — | Statut tâche Celery |
| 8 | POST | `/api/invoices` | JWT | Org | Créer facture |
| 9 | GET | `/api/invoices` | JWT | Org | Lister factures |
| 10 | GET | `/api/invoices/filters` | JWT | Org | Valeurs de filtres |
| 11 | GET | `/api/invoices/:id` | JWT | Org | Détail facture |
| 12 | PUT | `/api/invoices/:id` | JWT | Org | Modifier facture |
| 13 | DELETE | `/api/invoices/:id` | JWT | Org | Supprimer facture |
| 14 | GET | `/api/invoices/:id/history` | JWT | Org | Historique facture |
| 15 | POST | `/api/invoices/:id/validate` | JWT | Org | Validation conformité |
| 16 | POST | `/api/invoices/:id/verify-signature` | JWT | Org | Vérifier signature |
| 17 | POST | `/api/invoices/:id/submit-ttn` | JWT | Org | Soumettre à TTN |
| 18 | GET | `/api/invoices/:id/compliance-report` | JWT | Org | Rapport conformité |
| 19 | GET | `/api/stats` | JWT | Org | Statistiques dashboard |
| 20 | GET | `/api/activity` | JWT | Org | Journal d'activité |
| 21 | GET | `/api/admin/users` | JWT | — | Lister utilisateurs |
| 22 | POST | `/api/admin/users` | JWT | — | Créer utilisateur |
| 23 | PUT | `/api/admin/users/:id` | JWT | — | Modifier utilisateur |
| 24 | PUT | `/api/admin/users/:id/toggle-status` | JWT | — | Activer/désactiver |
| 25 | DELETE | `/api/admin/users/:id` | JWT | — | Supprimer utilisateur |
| 26 | GET | `/api/export/invoices/excel` | JWT | Org | Export Excel global |
| 27 | GET | `/api/export/invoice/:id/excel` | JWT | Org | Export Excel unitaire |
| 28 | POST | `/api/advisor/chat` | JWT | Org | Chat conseiller IA |
| 29 | GET | `/api/notifications/auth` | JWT | — | Auth MagicBell |
| 30 | GET | `/api/notifications` | JWT | — | Lister notifications |
| 31 | POST | `/api/notifications/:id/read` | JWT | — | Marquer comme lue |
| 32 | POST | `/api/notifications/mark-all-read` | JWT | — | Tout marquer lu |
| 33 | POST | `/api/notifications/test` | JWT | — | Test notification |
| 34 | GET | `/api/tej/rates` | JWT | — | Taux de retenue |
| 35 | POST | `/api/tej/calculate` | JWT | — | Calcul retenue |
| 36 | POST | `/api/tej/generate` | JWT | — | Générer XML TEJ |
| 37 | POST | `/api/tej/validate` | JWT | — | Valider XML XSD |
| 38 | POST | `/api/tej/batch-csv` | JWT | — | Import CSV par lot |
| 39 | POST | `/api/tej/export-pdf` | JWT | — | Export PDF certificat |
| 40 | GET | `/api/tej/certificates` | JWT | — | Lister certificats |
| 41 | POST | `/api/tej/certificates` | JWT | — | Créer certificat |
| 42 | GET | `/api/tej/certificates/:id` | JWT | — | Détail certificat |
| 43 | PUT | `/api/tej/certificates/:id` | JWT | — | Modifier brouillon |
| 44 | DELETE | `/api/tej/certificates/:id` | JWT | — | Supprimer brouillon |
| 45 | POST | `/api/tej/certificates/:id/submit` | JWT | — | Soumettre certificat |
| 46 | GET | `/api/tej/certificates/:id/pdf` | JWT | — | Télécharger PDF |
| 47 | GET | `/api/tej/dashboard` | JWT | — | Dashboard TEJ |
| 48 | GET | `/api/orgs` | JWT | — | Lister organisations |
| 49 | POST | `/api/orgs` | JWT | — | Créer organisation |
| 50 | GET | `/api/orgs/:id` | JWT | — | Détail organisation |
| 51 | PUT | `/api/orgs/:id` | JWT | — | Modifier organisation |
| 52 | DELETE | `/api/orgs/:id` | JWT | — | Désactiver organisation |
| 53 | POST | `/api/orgs/:id/switch` | JWT | — | Changer d'organisation |
| 54 | GET | `/api/orgs/:id/members` | JWT | Org | Lister membres |
| 55 | PUT | `/api/orgs/:id/members/:uid` | JWT | Org | Changer rôle |
| 56 | DELETE | `/api/orgs/:id/members/:uid` | JWT | Org | Retirer membre |
| 57 | POST | `/api/orgs/:id/invitations` | JWT | Org | Envoyer invitation |
| 58 | GET | `/api/orgs/:id/invitations` | JWT | Org | Lister invitations |
| 59 | DELETE | `/api/orgs/:id/invitations/:iid` | JWT | Org | Révoquer invitation |
| 60 | POST | `/api/invitations/:token/accept` | JWT | — | Accepter invitation |
| 61 | GET | `/api/plans` | — | — | Lister plans |
| 62 | GET | `/api/orgs/:id/billing` | JWT | Org | Info facturation |
| 63 | POST | `/api/orgs/:id/billing/checkout` | JWT | Org | Session Stripe |
| 64 | POST | `/api/orgs/:id/billing/portal` | JWT | Org | Portail Stripe |
| 65 | POST | `/api/webhooks/stripe` | — | — | Webhook Stripe |

## Annexe D : Taux de retenue à la source (TEJ)

| Type de retenue | Résident (individu) | Résident (société) | Non-résident |
|----------------|:-------------------:|:------------------:|:------------:|
| Salaires | Barème progressif | — | 20 % |
| Honoraires et commissions | 15 % | 10 % | 20 % |
| Loyers | 15 % | 10 % | — |
| Achats (non-inscrit) | 1,5 % | 1 % | — |
| Services non-résidents | — | — | 10–20 % |
| Commissions et courtages | 15 % | 10 % | — |

---

<div align="center">

*Rapport de Projet de Fin d'Études — SmartInvoice AI*

*Anas Badri — Année universitaire 2025–2026*

*~29 400 lignes de code · 70+ endpoints API · 18 services back-end · 62+ composants front-end*

</div>

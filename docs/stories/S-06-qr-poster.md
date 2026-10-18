# S-06 · QR code de l'affiche du salon

**En tant que** gérant, **je veux** télécharger le QR code de l'affiche de mon salon en PDF A4 et pouvoir le régénérer en cas d'abus, **afin que** les clients qui passent devant le salon rejoignent la file depuis leur navigateur, sans rien installer.

- Priorité : I (PRD §5.3)
- Règles appliquées : H7 (l'arrivée se valide par le code du ticket ; le QR de l'affiche ne sert qu'à rejoindre la file) ; PRD §11 n° 7 ; objectif « Servir les clients sans app » (PRD §2)
- Parcours : F-M2 « QR code », F-M11 `/dashboard/salon` ; scan côté client F-C4 (story U-05)
- Commandes et données : RPC `resolve_qr_token` · tables `salons` (`qr_token`), `salon_events` (`qr_regenerated`) · bucket `qr-posters`

## Scénarios

### 1. Télécharger l'affiche
- **Étant donné** le gérant à l'étape « QR code » du wizard ou sur `/dashboard/salon`
- **Quand** il clique sur « Télécharger le PDF A4 »
- **Alors** un fichier PDF au format A4 est téléchargé
- **Alors** le QR code du PDF ouvre l'adresse `/q/:qrToken` du salon

### 2. Un client scanne l'affiche d'un salon publié
- **Étant donné** un salon publié dont le QR est valide
- **Quand** un client scanne le QR de l'affiche avec son téléphone
- **Alors** le navigateur ouvre l'étape 1 de « Rejoindre la file » avec l'en-tête « Vous êtes chez *Salon* » (F-C4)
- **Alors** le ticket créé depuis ce parcours a le canal `qr`

### 3. Régénérer le QR
- **Étant donné** le gérant sur l'étape « QR code » ou sur `/dashboard/salon`
- **Quand** il clique sur « Régénérer »
- **Alors** une boîte de confirmation lui indique que l'ancien QR cessera de fonctionner
- **Quand** il confirme
- **Alors** un nouveau jeton `qr_token` remplace l'ancien
- **Alors** l'événement `qr_regenerated` est inscrit au journal du salon
- **Alors** « Télécharger le PDF A4 » fournit l'affiche avec le nouveau QR

### 4. Renoncer à la régénération
- **Étant donné** la boîte de confirmation de régénération ouverte
- **Quand** le gérant la ferme sans confirmer
- **Alors** le jeton `qr_token` reste le même
- **Alors** l'affiche déjà imprimée continue de fonctionner

### 5. Scan d'un ancien QR après régénération
- **Étant donné** un QR régénéré
- **Quand** un client scanne l'ancienne affiche
- **Alors** il voit le message « Ce QR code n'est plus valide, demandez à l'accueil » (texte de F-C4, story U-05)
- **Alors** aucun ticket n'est créé

### 6. Scan avant la publication du salon
- **Étant donné** un salon qui n'est pas encore publié
- **Quand** un client scanne son affiche
- **Alors** le salon n'est pas trouvé, car `resolve_qr_token` ne renvoie que les salons publiés
- **Alors** aucun ticket n'est créé

### 7. Isolation par salon
- **Étant donné** le gérant du salon A
- **Quand** il essaie de télécharger l'affiche du salon B ou de régénérer son QR (par l'API ou le stockage)
- **Alors** l'accès est refusé

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `pro-manager.qr.title` | « QR code » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.qr.download` | « Télécharger le PDF A4 » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.qr.regenerate` | « Régénérer » | Libellé indicatif (APP_FLOW F-M2) |
| `pro-manager.qr.regenerate.confirm` | — (à rédiger) | Doit dire que l'ancien QR cesse de fonctionner (APP_FLOW F-M2) |
| `pro-manager.qr.poster.<element>` | — (à rédiger) | Textes imprimés sur l'affiche A4 |

## Questions ouvertes
- **TRD / BACKEND_SCHEMA** : TRD §6 ne contient aucune commande ni fonction pour régénérer le QR ou produire le PDF. De plus, `qr_token` ne fait pas partie des champs que le gérant peut écrire (BACKEND_SCHEMA §7.2 : nom, téléphone, adresse, photos, message, délais). Qui écrit le nouveau jeton, et qui produit le PDF : le navigateur avec la bibliothèque `qrcode`, ou une fonction qui le dépose dans `qr-posters` ?
- **APP_FLOW / DESIGN_SYSTEM** : le contenu de l'affiche A4 (nom du salon, phrase d'appel, consignes, charte graphique) n'est décrit nulle part.
- **APP_FLOW** : que voit un client qui scanne l'affiche d'un salon pas encore publié ? Le même message que pour un QR régénéré ?
- **PRD** : la régénération est-elle sans effet sur les tickets déjà créés avec l'ancien QR ? Cela semble aller de soi, mais n'est écrit nulle part.
- **APP_FLOW** : les textes marqués « à rédiger » ne figurent dans aucun document.

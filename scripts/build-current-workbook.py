#!/usr/bin/env python3
"""Rebuild the dated current workbook using artifact_tool, not a game dependency."""
from artifact_tool import Workbook, SpreadsheetFile
import json, math, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
track = json.loads((root/"docs/parallaxe-open-work-20261101.json").read_text())
design = json.loads((root/"docs/anomalies-design.json").read_text())
runtime = json.loads((root/"docs/runtime-catalog.json").read_text())
gap = json.loads((root/track["gap_json"]).read_text())
by_id = {a["id"]:a for a in runtime}
wb = Workbook.create()
navy, muted, pale, teal, amber = "#173A4B", "#53616B", "#F3F6F7", "#DDEEE8", "#FFF2D8"
sheets = {}
def add_table(name, headers, rows, widths, status_col=None):
    sheet = wb.worksheets.add(name); sheets[name] = sheet
    cols = len(headers); end = len(rows)+5
    def col(n):
        s="";n+=1
        while n: n,r=divmod(n-1,26);s=chr(65+r)+s
        return s
    last=col(cols-1)
    sheet.get_range(f"A1:{last}{end}").format.font = {"name":"Arial","size":10,"color":"#162733"}
    sheet.merge_cells(f"A1:{last}1")
    sheet.get_range("A1").values = [[f"PARALLAXE / {name.upper()}"]]
    sheet.get_range(f"A1:{last}1").format = {"fill":navy,"font":{"name":"Arial","size":17,"bold":True,"color":"#FFFFFF"},"row_height":34}
    sheet.merge_cells(f"A3:{last}3")
    sheet.get_range("A3").values = [["Suivi du 11 novembre 2026 · Présent dans le code ≠ validé sur matériel · Archives conservées."]]
    sheet.get_range(f"A3:{last}3").format = {"font":{"name":"Arial","size":10,"italic":True,"color":muted},"row_height":24}
    sheet.get_range(f"A5:{last}{end}").values = [headers]+rows
    sheet.tables.add(f"A5:{last}{end}",True,"P9_"+str(len(sheets))+"_Table")
    sheet.get_range(f"A5:{last}5").format = {"fill":navy,"font":{"bold":True,"color":"#FFFFFF"},"wrap_text":True,"vertical_alignment":"center","row_height":32}
    sheet.get_range(f"A6:{last}{end}").format.wrap_text = True
    sheet.get_range(f"A6:{last}{end}").format.vertical_alignment = "top"
    for j,w in enumerate(widths):sheet.get_range(f"{col(j)}1:{col(j)}{end}").format.column_width=w
    for i,row in enumerate(rows):
        maxlines=max((sum(max(1,math.ceil(len(line)/(widths[j]*.95))) for line in str(v or "").splitlines()) for j,v in enumerate(row)),default=1)
        sheet.get_range(f"A{i+6}:{last}{i+6}").format.row_height=max(34,min(300,12*maxlines+10))
        if i%2==0:sheet.get_range(f"A{i+6}:{last}{i+6}").format.fill=pale
    sheet.freeze_panes.freeze_rows(5);sheet.freeze_panes.freeze_columns(2 if cols>4 else 1)
    if status_col is not None:
        rng=sheet.get_range(f"{col(status_col)}6:{col(status_col)}{end}")
        rng.conditional_formats.add_custom(f'=ISNUMBER(SEARCH("non implémenté",{col(status_col)}6))',{"fill":amber})
        rng.conditional_formats.add_custom(f'=ISNUMBER(SEARCH("QA partielle",{col(status_col)}6))',{"fill":teal})
    return sheet

summary = wb.worksheets.add("Synthèse"); sheets["Synthèse"] = summary
summary.get_range("A1:H30").format.font={"name":"Arial","size":10,"color":"#162733"}
summary.merge_cells("A1:H2");summary.get_range("A1").values=[["PARALLAXE — PROTOCOLE 9"]]
summary.get_range("A1:H2").format={"fill":navy,"font":{"name":"Arial","size":21,"bold":True,"color":"#FFFFFF"},"row_height":24,"vertical_alignment":"center"}
summary.merge_cells("A3:H3");summary.get_range("A3").values=[["11 novembre 2026 · voix locales et autorisations · état courant 117 / 120"]]
for c,w in zip("ABCDEFGH",[34,17,4,19,19,19,17,17]):summary.get_range(f"{c}1:{c}30").format.column_width=w
summary.get_range("A6:B6").values=[["CATALOGUE","TOTAL"]]
summary.get_range("A7:A13").values=[["Concepts originaux"],["Présents dans le code"],["Encore non intégrés"],["Part implémentée"],["Entrées de suivi"],["Lots prioritaires"],["Recettes QA encore ouvertes"]]
summary.get_range("A6:B6").format={"fill":navy,"font":{"bold":True,"color":"#FFFFFF"},"row_height":28}
summary.get_range("A7:B13").format.row_height=28
summary.get_range("B7:B13").format.font={"name":"Arial","size":15,"bold":True,"color":navy}

anomaly_rows=[]
for a in design["anomalies"]:
    code=by_id.get(a[0])
    anomaly_rows.append([a[0],a[1],a[2],"Oui" if code else "Non","Implémenté — QA partielle" if code else "Conçu — non implémenté",", ".join(code.get("levels",[])) if code else a[3],a[5],a[6],a[7],a[9],a[12],f"https://github.com/darknigthmare/Parallaxe_Protocole9/blob/continuation/observations-20261110/docs/anomalies-design.json"])
add_table("Anomalies",["ID moteur","Anomalie","Famille","En code","Statut","Lieux","Référence d’origine","Perception A d’origine","Perception B d’origine","Déclenchement d’origine","Équité / recette","Source"],anomaly_rows,[29,30,19,10,30,24,40,40,40,36,40,38],4)

items=track["items"]
add_table("Registre ouvert",["Clé stable","Domaine","ID","Objet","Priorité","Statut source","Nature","Action","Critère corrigé","Preuve exigée","Recette / contrôle","Limites et détails","Source"],[[r[k] for k in ["cle","domaine","id","nom","priorite","statut_source","nature","action","critere","preuve_exigee","verification","details","source"]] for r in items],[32,24,16,28,10,30,24,40,40,35,38,40,38],5)
add_table("Lots prioritaires",["Lot","Priorité","Domaine","Action","Critère de fin","Preuve","Dépendances","État"],[[r[k] for k in ["id","priorite","domaine","action","criteres","preuve","liens","etat"]] for r in track["lots"]],[12,10,28,40,40,38,30,26])
qa=[r for r in items if r["domaine"]=="QA"]
add_table("Recette QA",["ID","Parcours","Priorité","État","Étapes","Résultat attendu","Limites / preuve","Source"],[[r[k] for k in ["id","nom","priorite","statut_source","action","critere","details","source"]] for r in qa],[14,27,10,28,40,40,40,38],3)
add_table("Restantes",["ID","Nom","Priorité","Lieu requis","Référence originale","A","B","Déclenchement","Production nécessaire","Recette d’acceptation"],[[r[k] for k in ["id","name","priority","target","baseline","perceptionA","perceptionB","trigger","technicalImplementation","qaAcceptance"]] for r in gap["remaining_anomalies"]],[29,28,10,32,40,38,38,34,40,40])
changes=[
["PAUSE-OBS","Correctif", "Arrêt du temps des observations pendant les menus, la lecture, les onglets masqués et la perte de focus.", "Régression du vrai moteur de scène ; le portrait ne change pas durant 25 s d’interruption.", "Cette garde ne certifie pas le rendu du navigateur.", "app/game.tsx ; src/game/scene.ts"],
["paired_stars","Nouveau cas","6 points en référence ; 4 à gauche / 4 à droite dans les deux perceptions. L’union reconstitue les six positions.","Tests de masques et de projection privée ; géométrie et GPU à distinguer.","La station ICI évite de confondre gauche et droite.","src/game/observation-state.ts"],
["photo_age","Nouveau cas","Le portrait change après 10 s près du cadre, progressivement sur 12 s. Transformation conservée lors d’une bascule solo A/B.","Seuil, durée, pause, changement de lieu, reset et A/B testés à 10/30/60/144 images/s.","Le portrait est original et procédural ; recette visuelle restante.","src/game/observation-world.ts"],
["stair_wrong_shadow","Nouveau cas","Rampe réelle à six montants et applique ; la projection seule devient un escalier.","Géométrie, absence de déplacement des collisions, retour à l’ombre normale.","La preuve dessinée reste disponible sans ombres GPU.","src/game/observation-world.ts"],
["ceiling_walker","Nouveau cas","Silhouette riggée inversée, déclenchée dans la seconde moitié du couloir, lente et non poursuivante.","Déclenchement, persistance, mouvement, vue privée et reset.","Aucune nouvelle collision avec le joueur.","src/game/observation-world.ts"],
["PING-02","Correctif","Le serveur accepte les repères manteau/extincteur et les nouveaux repères.","Test des cinq cibles, sans transfert du résultat privé.","Aucun changement des règles de vote.","src/game/session.ts"],
["MIST-01","Correctif","La brume de l’extincteur tourne autour du centre du cylindre, pas autour de la fixation murale.","Contrôle géométrique sur 100 pas et retour normal.","Contrôle GPU distinct.","src/game/scene.ts"],
["XLSX-446","Correction du suivi","446 critères et actions reliés aux bonnes colonnes d’origine. Commandes de recette remises dans leur domaine.","Clés et sources conservées ; états historiques non clôturés arbitrairement.","600 entrées ne représentent pas 600 fonctionnalités absentes.","docs/parallaxe-open-work-20261101.json"],
]
changes.extend(json.loads((root/"docs/acoustic-delivery-20261111.json").read_text()))
changes.extend(json.loads((root/"docs/temporal-delivery-20261111.json").read_text()))
changes.extend(json.loads((root/"docs/lift-delivery-20261111.json").read_text()))
changes.extend(json.loads((root/"docs/spoken-delivery-20261111.json").read_text()))
add_table("Livraison",["ID","Type","Modification appliquée","Vérification prévue ou exécutée","Limites","Source"],changes,[29,21,40,40,40,38])
sources=[["Base de développement","https://github.com/darknigthmare/Parallaxe_Protocole9/commit/a1774830149d485af800133f688e94b208940883","Branche main examinée ; code de jeu identique à l’archive edbeab61."],
["Fiches originales","https://github.com/darknigthmare/Parallaxe_Protocole9/blob/main/docs/anomalies-design.json","120 fiches originales conservées sans réécriture de leurs A/B."],
["Source actuelle","https://github.com/darknigthmare/Parallaxe_Protocole9/tree/continuation/observations-20261110","Branche du lot, pas une publication du site."],
["Contrôles CPU","tests/observation-state.test.mjs ; tests/observation-world.test.mjs","Chronométrie/logique ne certifient pas un rendu GPU."],
["Registre de travail","docs/parallaxe-open-work-20261101.json","600 clés maintenues, 446 critères remappés."],
["Liste restante",track["gap_json"],f"{len(gap['remaining_anomalies'])} cas non intégrés ; CSV synchronisé."],
]+[[p,"Archive conservée","Ne pas utiliser son ancien compteur pour la version actuelle."] for p in track["historical_workbooks"]]+[[f"docs/{p}","Classeur historique conservé","Son état antérieur n’est pas une recette du nouveau lot."] for p in ["PARALLAXE_Design_Complet.xlsx","PARALLAXE_Suivi_Reprise_2026-10-28.xlsx","PARALLAXE_Suivi_Sessions_2026-10-29.xlsx"]]
add_table("Sources",["Référence","Lien / chemin","Portée"],sources,[36,40,40])
summary.get_range("B7:B13").formulas=[
["=COUNTA('Anomalies'!$A$6:$A$125)"],
['=COUNTIF(\'Anomalies\'!$D$6:$D$125,"Oui")'],
["=B7-B8"],["=B8/B7"],
["=COUNTA('Registre ouvert'!$A$6:$A$605)"],
["=COUNTA('Lots prioritaires'!$A$6:$A$33)"],
["=COUNTA('Recette QA'!$A$6:$A$129)"]]
summary.get_range("B10").format.number_format="0.0%"
summary.merge_cells("A16:H16");summary.get_range("A16").values=[["REPRISE : BULLETIN VOCAL ET ÉPELLATION CONSENTIE"]]
summary.get_range("A16:H16").format={"fill":navy,"font":{"bold":True,"color":"#FFFFFF"},"row_height":27}
notes=[
"Les 115 cas précédents sont conservés ; le poste vocal et le conduit nominatif sont ajoutés.",
"E : tester le poste. Approchez le conduit ; épellation uniquement avec accord explicite. R arrête.",
"446 lignes ont retrouvé leur vrai critère de fin ; les 600 clés de suivi restent conservées.",
f"{len(runtime)} cas sont intégrés au code ; {len(gap['remaining_anomalies'])} concepts restent à développer. La réception humaine n’est pas clôturée.",
"Les recettes GPU, microphones, TURN et 2–4 appareils physiques restent à effectuer.",
"La campagne reste Saint-Clair → Terminus 09 → Aile blanche ; le Chalet reste un lieu autonome.",
"Les anciens Excel sont des archives. Ce classeur et son fichier source JSON portent l’état courant."
]
for i,text in enumerate(notes,18):
    summary.merge_cells(f"A{i}:H{i}");summary.get_range(f"A{i}").values=[[text]]
    summary.get_range(f"A{i}:H{i}").format={"wrap_text":True,"row_height":30,"fill":pale if i%2==0 else "#FFFFFF","font":{"name":"Arial","size":11,"color":muted}}
chart=summary.charts.add("bar",summary.get_range("A8:B9"));chart.title_text="Implémentation des 120 concepts";chart.has_legend=False;chart.set_position("D6","H14")
summary.freeze_panes.freeze_rows(3)
print(wb.inspect({"kind":"table","range":"Synthèse!A6:B13","include":"values,formulas","table_max_rows":8,"table_max_cols":2}).ndjson)
print(wb.inspect({"kind":"match","search_term":"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A","options":{"use_regex":True,"max_results":20},"summary":"formules"}).ndjson)
wb.render({"sheet_name":"Synthèse","range":"A1:H25","scale":1.4}).save(str(root/"docs/parallaxe-suivi-preview.png"))
output=str(root/track["classeur_courant"])
SpreadsheetFile.export_xlsx(wb).save(output)
print(output)

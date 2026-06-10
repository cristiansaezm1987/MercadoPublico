with open("dashboard/templates/dashboard/index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

in_tab = False
for i, line in enumerate(lines):
    if 'id="tab-recommend"' in line:
        in_tab = True
    if in_tab:
        print(f"{i+1}: {line}", end='')
    if in_tab and 'id="tab-simulator"' in line:
        break

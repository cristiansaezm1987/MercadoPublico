with open("dashboard/templates/dashboard/index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'cot-active-count' in line:
        for j in range(i, min(i+40, len(lines))):
            print(f"{j+1}: {lines[j]}", end='')
        break

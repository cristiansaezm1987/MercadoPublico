with open("dashboard/templates/dashboard/index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'id="cot-results-body"' in line:
        for j in range(i, min(i+15, len(lines))):
            print(f"{j+1}: {lines[j]}", end='')
        break

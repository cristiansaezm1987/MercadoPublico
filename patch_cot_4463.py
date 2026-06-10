# -*- coding: utf-8 -*-
import io

with io.open("dashboard/views.py", "r", encoding="utf-8") as f:
    text = f.read()

# Replace the budget
text = text.replace('"presupuesto": 450000,', '"presupuesto": 6700000,')

# Replace the items for 4463-463-COT26
old_items = '{"producto": "Paracetamol inyectable 1gr", "cantidad": 200}'
new_items = '{"producto": "PARACETAMOL INYECTABLE 1 GR / 100 ML", "cantidad": 7000}'
text = text.replace(old_items, new_items)

# Add description if needed, but not strictly required if main.js doesn't show it.
# Wait, I'll just change the data.
with io.open("dashboard/views.py", "w", encoding="utf-8") as f:
    f.write(text)
    
print("Updated budget and items for 4463-463-COT26")

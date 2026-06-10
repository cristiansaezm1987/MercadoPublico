import os

files = ['index.html', 'dashboard/templates/dashboard/index.html']
for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # Remove inline style="display: none;" from tab-mis-licitaciones
    text = text.replace('id="tab-mis-licitaciones" class="tab-content" style="display: none;"', 'id="tab-mis-licitaciones" class="tab-content"')
    
    # Bump cache buster
    text = text.replace('v=100', 'v=101')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)

print('Fixed inline styles')

with open("main.js", "r", encoding="utf-8") as f:
    js = f.read()

start = js.find("function setupCotSincronizador")
if start != -1:
    end = js.find("function showCotAnalytics", start)
    if end != -1:
        print(js[start:end][:2500])

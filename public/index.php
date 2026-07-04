<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#14532d">
<title>FireCheck — เช็คชื่อสถานีควบคุมไฟป่า</title>
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11.14.5/dist/sweetalert2.all.min.js"></script>
<link rel="stylesheet" href="assets/app.css?v=14">
</head>
<body>
<div id="app">
  <div class="splash">
    <div class="splash-logo">🔥</div>
    <div class="splash-text">FireCheck</div>
    <div class="spinner"></div>
  </div>
</div>
<script src="assets/app.js?v=14"></script>
<script src="assets/admin.js?v=14"></script>
<script>
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
App.init();
</script>
</body>
</html>

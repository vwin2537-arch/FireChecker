# FireCheck — สำหรับ deploy บน Railway (หรือ Docker ทั่วไป)
FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql

# docroot ชี้ที่ public/
RUN sed -ri 's!/var/www/html!/var/www/html/public!g' \
      /etc/apache2/sites-available/000-default.conf /etc/apache2/apache2.conf

# รองรับรูป base64 ก้อนใหญ่
RUN printf 'post_max_size=40M\nupload_max_filesize=20M\nmemory_limit=256M\n' \
      > /usr/local/etc/php/conf.d/firecheck.ini

COPY . /var/www/html/

# Railway กำหนดพอร์ตผ่าน $PORT
# ลบ mpm_event/mpm_worker ตอนรัน (ไม่ใช่ตอน build) — บน Railway ไฟล์ที่ลบตอน build layer ไม่ persist มาถึง runtime
CMD ["bash", "-c", "rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.* && sed -i \"s/Listen 80/Listen ${PORT:-80}/\" /etc/apache2/ports.conf && sed -i \"s/:80>/:${PORT:-80}>/\" /etc/apache2/sites-available/000-default.conf && apache2-foreground"]

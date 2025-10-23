# 🚀 دليل النشر على Railway

## 📋 المتطلبات

- حساب على [Railway](https://railway.app)
- حساب على [GitHub](https://github.com)
- بوت دسكورد جاهز

## 🔧 خطوات النشر

### 1. إعداد المشروع

#### أ. إنشاء ملف .env
```bash
# انسخ ملف env.example إلى .env
cp env.example .env
```

#### ب. إعداد متغيرات البيئة
افتح ملف `.env` وأدخل البيانات:
```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_application_id_here
PORT=3000
```

### 2. رفع المشروع على GitHub

#### أ. تهيئة Git
```bash
git init
git add .
git commit -m "Initial commit: Discord Music Bot"
```

#### ب. ربط مع GitHub
```bash
git remote add origin https://github.com/username/repository-name.git
git branch -M main
git push -u origin main
```

### 3. النشر على Railway

#### أ. تسجيل الدخول لـ Railway
1. اذهب إلى [Railway](https://railway.app)
2. اضغط "Login with GitHub"
3. سجل دخولك بحساب GitHub

#### ب. إنشاء مشروع جديد
1. اضغط "New Project"
2. اختر "Deploy from GitHub repo"
3. اختر المستودع الخاص بك

#### ج. إعداد متغيرات البيئة
1. اذهب إلى "Variables" في المشروع
2. أضف المتغيرات التالية:
   - `DISCORD_TOKEN`: رمز البوت
   - `CLIENT_ID`: معرف التطبيق
   - `PORT`: 3000 (اختياري)

#### د. النشر
1. اضغط "Deploy"
2. انتظر حتى يكتمل النشر
3. احصل على الرابط من "Settings" > "Domains"

## 🔧 إعدادات إضافية

### Railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### package.json
```json
{
  "engines": {
    "node": ">=16.9.0"
  },
  "scripts": {
    "start": "node index.js",
    "build": "echo 'No build step required'"
  }
}
```

## 🌐 الوصول للبوت

### لوحة التحكم
```
https://your-app-name.railway.app
```

### تحديث رابط لوحة التحكم
1. اذهب إلى Railway Dashboard
2. اختر مشروعك
3. اذهب إلى "Variables"
4. أضف متغير `RAILWAY_STATIC_URL`
5. ضع رابط التطبيق

## 🔍 استكشاف الأخطاء

### البوت لا يعمل
1. تحقق من متغيرات البيئة
2. راجع logs في Railway
3. تأكد من صحة الـ Token

### لوحة التحكم لا تعمل
1. تحقق من متغير `RAILWAY_STATIC_URL`
2. تأكد من أن البوت يعمل
3. راجع logs للتأكد من عدم وجود أخطاء

## 📱 نصائح للنشر

1. **استخدم متغيرات البيئة** بدلاً من ملفات config
2. **تحقق من logs** بانتظام
3. **احتفظ بنسخة احتياطية** من الإعدادات
4. **اختبر البوت** بعد النشر

## 🎉 تهانينا!

البوت الآن يعمل على Railway! 🚀

### الخطوات التالية:
1. اختبر البوت في دسكورد
2. جرب لوحة التحكم
3. أضف المزيد من المميزات
4. شارك البوت مع الأصدقاء!

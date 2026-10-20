# 🏠 Triển khai Localhost

Chạy Bansur Router trên máy cá nhân để phát triển và dùng cá nhân.

---

## 📦 Cài đặt

Cài đặt Bansur Router toàn cục qua npm:

```bash
npm install -g bansur-router
```

**Yêu cầu:**
- Node.js 20 trở lên
- npm 9 trở lên

---

## 🚀 Khởi động Server

Khởi động Bansur Router với một lệnh duy nhất:

```bash
bansur-router
```

Dashboard sẽ tự động mở trong trình duyệt tại `http://localhost:3000`

**Cấu hình mặc định:**
- **Dashboard**: `http://localhost:3000`
- **API Endpoint**: `http://localhost:667/v1`
- **Data Directory**: `~/.bansur-router`

---

## 🔧 Cấu hình

### Custom Data Directory

Đặt thư mục data tùy chỉnh qua biến môi trường:

```bash
DATA_DIR=/path/to/data bansur-router
```

### Custom Port

Port API (667) và port dashboard (3000) được cấu hình trong application. Để đổi, bạn cần sửa source code hoặc dùng biến môi trường nếu được hỗ trợ.

---

## 🛑 Dừng Server

Nhấn `Ctrl+C` trong terminal đang chạy Bansur Router.

```bash
# In the terminal running bansur-router
^C  # Press Ctrl+C
```

Server sẽ shutdown an toàn và lưu mọi dữ liệu.

---

## 🔄 Khởi động lại Server

Chỉ cần chạy lệnh start lại:

```bash
bansur-router
```

Mọi cấu hình, API keys và combos được giữ lại trong thư mục data.

---

## 📊 Cập nhật Bansur Router

Cập nhật phiên bản mới nhất:

```bash
npm update -g bansur-router
```

Kiểm tra version hiện tại:

```bash
npm list -g bansur-router
```

---

## 🔍 Troubleshooting

### Port đã được dùng

Nếu port 667 hoặc 3000 đã được dùng:

```bash
# Find process using the port (macOS/Linux)
lsof -i :667
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Lỗi Permission

Nếu gặp lỗi permission khi cài đặt:

```bash
# Use sudo (not recommended)
sudo npm install -g bansur-router

# Or fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Vấn đề Data Directory

Nếu thư mục data không truy cập được:

```bash
# Check permissions
ls -la ~/.bansur-router

# Fix permissions
chmod 755 ~/.bansur-router
```

---

## 📁 Cấu trúc Data Directory

```
~/.bansur-router/
├── db.json           # Main database (providers, combos, settings)
├── logs/             # Application logs
└── cache/            # Temporary cache files
```

**Backup Data:**

```bash
# Backup
cp -r ~/.bansur-router ~/.bansur-router.backup

# Restore
cp -r ~/.bansur-router.backup ~/.bansur-router
```

---

## 🔗 Bước tiếp theo

- [Kết nối Providers](/providers/subscription.md)
- [Tạo Combos](/features/combos.md)
- [Tích hợp với CLI Tools](/integration/cursor.md)

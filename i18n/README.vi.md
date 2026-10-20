<div align="center">

<img src="../images/banner.png" alt="Bansur Router" width="880"/>

**Một endpoint cho mọi nhà cung cấp AI.**

[![npm](https://img.shields.io/npm/v/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Downloads](https://img.shields.io/npm/dm/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Docker Pulls](https://img.shields.io/docker/pulls/bansur/router.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/bansur/router)
[![Docker Version](https://img.shields.io/docker/v/bansur/router?logo=docker&label=Docker%20version)](https://hub.docker.com/r/bansur/router)
[![GHCR](https://img.shields.io/badge/GHCR-mas-ajam%2Fbansur-router-blue?logo=github)](https://github.com/mas-ajam/bansur-router/pkgs/container/bansur-router)
[![License](https://img.shields.io/npm/l/bansur-router.svg)](https://github.com/mas-ajam/bansur-router/blob/main/LICENSE)

[Bắt đầu nhanh](#bắt-đầu-nhanh) · [Tính năng chính](#tính-năng-chính) · [Nhà cung cấp](#nhà-cung-cấp-được-hỗ-trợ) · [Hướng dẫn cài đặt](#hướng-dẫn-cài-đặt) · [Tài liệu](https://bansur-router.pages.dev)

[🇧🇷 Português (Brasil)](./README.pt-BR.md) • [🇻🇳 Tiếng Việt](./README.vi.md) • [🇨🇳 中文](./README.zh-CN.md) • [🇯🇵 日本語](./README.ja-JP.md) • [🇷🇺 Русский](./README.ru.md) • [🇹🇭 ไทย](./README.th.md) • [🇮🇷 فارسی](./README.fa_IR.md) • [🇮🇩 Indonesia](./README.id-ID.md) • [🇪🇸 Español](./README.es.md) • [🇫🇷 Français](./README.fr.md)

</div>

---

# Bansur Router

Bansur Router là một cổng AI cục bộ dành cho các công cụ lập trình. Nó chạy trên chính máy của bạn và đặt một endpoint duy nhất tương thích OpenAI — `http://localhost:667/v1` — trước mọi nhà cung cấp mà bạn kết nối vào nó.

Cấu hình công cụ của bạn một lần duy nhất. Từ đó trở đi, Bansur Router xử lý các kết nối nhà cung cấp phía sau endpoint đó: tài khoản nào trả lời một yêu cầu, định dạng của yêu cầu được dịch như thế nào, hạn mức còn lại bao nhiêu, và điều gì xảy ra khi một nhà cung cấp từ chối. Các gói đăng ký bạn đã trả tiền được dùng trước, các API rẻ hơn tiếp quản khi chúng cạn, và các tầng miễn phí giữ cho phiên làm việc vẫn tiếp tục ở cuối chuỗi.

Bảng điều khiển chạy tại `http://localhost:667/dashboard`, nơi bạn kết nối các nhà cung cấp, xây dựng các kết hợp mô hình (combo) và theo dõi việc sử dụng. Các khóa ở lại trên máy của bạn, lưu lượng được định tuyến cục bộ, và cổng được phát hành dưới dạng một gói npm cùng một image Docker, được xây dựng trên một ứng dụng Next.js chạy trên Node.js.

- **Một endpoint, một khóa** — mọi nhà cung cấp đã kết nối, có thể truy cập từ mọi công cụ
- **Hơn 800 mô hình** — được liệt kê trực tiếp qua `GET /v1/models`
- **Dự phòng 3 tầng** — Đăng ký, rồi Giá rẻ, rồi Miễn phí
- **Tiết kiệm token tích hợp sẵn** — đầu ra của công cụ được nén trước khi đến mô hình
- **Ưu tiên cục bộ** — khóa và lưu lượng của bạn ở lại trên máy của bạn

Phiên bản hiện tại: v1.0.5. Yêu cầu Node.js 20.9 trở lên.

---

## Tại sao chọn Bansur Router?

| Vấn đề | Bansur Router làm gì |
| --- | --- |
| Hạn mức gói đăng ký hết hạn mỗi tháng mà chưa dùng hết | Theo dõi hạn mức theo từng tài khoản và dùng hết trước khi nó được đặt lại |
| Giới hạn tốc độ (rate limit) làm bạn dừng lại giữa một phiên lập trình | Tự động dự phòng: Subscription → Cheap → Free |
| Đầu ra của công cụ như `git diff`, `grep` và `ls` ngốn rất nhiều token | Nén kết quả của công cụ bằng RTK, tiết kiệm 20–40% token cho mỗi yêu cầu |
| Mỗi nhà cung cấp đều muốn $20–50 mỗi tháng | Định tuyến công việc sang các tầng rẻ và miễn phí khi chúng đủ tốt |
| Chuyển đổi nhà cung cấp thủ công, riêng lẻ cho từng công cụ | Cho mỗi công cụ một endpoint và một khóa, với cơ chế vòng tròn (round-robin) nhiều tài khoản phía sau |

---

## Bắt đầu nhanh

### 1. Cài đặt và chạy

```bash
npm install -g bansur-router
bansur-router
```

Bảng điều khiển mở tại `http://localhost:667`.

### 2. Kết nối một nhà cung cấp

Mở **Dashboard → Providers → Connect**.

Bạn không cần tài khoản trả phí để bắt đầu. Kết nối **Kiro AI** để nhận một tầng miễn phí khoảng 50 tín dụng mỗi tháng, bao gồm Claude 4.5, GLM-5 và MiniMax, hoặc kết nối **OpenCode Free**, vốn không cần xác thực chút nào. Nếu bạn đã có gói đăng ký hoặc khóa API, hãy kết nối chúng thay thế — hoặc kết nối thêm cùng lúc.

### 3. Trỏ công cụ của bạn tới Bansur Router

```text
Endpoint: http://localhost:667/v1
API Key:  copy it from the dashboard
Model:    kr/claude-sonnet-4.5
```

Toàn bộ việc cài đặt chỉ có vậy. Công cụ giờ đây tiếp cận mọi nhà cung cấp đã kết nối qua một endpoint duy nhất đó, và Bansur Router quyết định mỗi yêu cầu sẽ đi đến đâu.

Các cách chạy Bansur Router khác — Docker và xây dựng từ mã nguồn — được trình bày trong [Hướng dẫn cài đặt](#hướng-dẫn-cài-đặt).

---

## Cách hoạt động

Mọi yêu cầu đến theo định dạng mà công cụ của bạn gửi, đi qua cổng, và rời đi theo định dạng mà nhà cung cấp được chọn mong đợi.

```text
Your CLI tool
  Claude Code, Codex, Cursor, Cline, ...
        |
        |  http://localhost:667/v1
        v
Bansur Router
  - RTK token saver (compress tool results)
  - Format translation (OpenAI <-> Claude <-> Gemini)
  - Quota tracking per account
  - Automatic OAuth token refresh
        |
        +--> Tier 1: SUBSCRIPTION
        |    Claude Code, Codex, GitHub Copilot
        |    (used first, while quota lasts)
        |
        +--> Tier 2: CHEAP
        |    GLM ($0.6 / 1M tokens), MiniMax ($0.20 / 1M tokens)
        |    (takes over when subscription quota runs out)
        |
        +--> Tier 3: FREE
             Kiro, OpenCode Free, Vertex AI ($300 credits
             for new Google Cloud accounts)
             (keeps the session running at no cost)
```

Dự phòng là tự động. Khi tầng đang hoạt động trả về lỗi hạn mức hoặc giới hạn tốc độ, yêu cầu sẽ di chuyển xuống chuỗi thay vì thất bại ngay trong trình soạn thảo của bạn.

---

## Tính năng chính

| Tính năng | Tác dụng |
| --- | --- |
| Tiết kiệm Token RTK | Nén đầu ra của công cụ — `git diff`, `grep`, `ls` và các kết quả tương tự — trước khi chúng được gửi đến mô hình, tiết kiệm 20–40% token cho mỗi yêu cầu |
| Tiết kiệm Token Headroom | Áp dụng thêm một lớp nén vào ngữ cảnh của yêu cầu, giảm thêm lượng token mà một phiên dài tiêu thụ |
| Dự phòng 3 tầng thông minh | Định tuyến mỗi yêu cầu theo thứ tự Subscription → Cheap → Free, tự động chuyển tầng khi cạn hạn mức hoặc bị giới hạn tốc độ |
| Theo dõi hạn mức theo thời gian thực | Hiển thị mức sử dụng trực tiếp và thời gian đặt lại theo từng tài khoản, để hạn mức đăng ký được dùng trước khi hết hạn thay vì sau đó |
| Dịch định dạng | Dịch giữa các định dạng yêu cầu của OpenAI, Claude và Gemini, để một công cụ được xây cho một API có thể dùng các nhà cung cấp được xây cho API khác |
| Hỗ trợ nhiều tài khoản | Giữ nhiều tài khoản cho mỗi nhà cung cấp và phân phối các yêu cầu giữa chúng bằng định tuyến vòng tròn (round-robin) |
| Tự động làm mới Token | Tự động làm mới các token OAuth, để các nhà cung cấp đã kết nối duy trì kết nối mà không cần đăng nhập lại nhiều lần |
| Combo tùy chỉnh | Nhóm các mô hình từ các nhà cung cấp và tầng khác nhau thành các kết hợp có tên mà bạn chọn như một mô hình duy nhất trong công cụ của mình |
| Ghi nhật ký yêu cầu | Ghi lại các yêu cầu và phản hồi để kiểm tra, giúp các vấn đề về định tuyến và nhà cung cấp trở nên rõ ràng thay vì âm thầm |
| Đồng bộ đám mây | Đồng bộ cấu hình của bạn giữa các máy, để một máy tính thứ hai bắt đầu từ cùng các nhà cung cấp và combo |
| Phân tích sử dụng | Phân tích chi tiết mức sử dụng token theo thời gian theo nhà cung cấp, tài khoản và mô hình |
| Triển khai mọi nơi | Chạy cục bộ, trong Docker, hoặc trên một VPS, với cùng một bảng điều khiển và endpoint trong mọi trường hợp |

---

## Công cụ CLI được hỗ trợ

Bất kỳ công cụ nào chấp nhận một endpoint tương thích OpenAI tùy chỉnh đều có thể dùng Bansur Router. Các công cụ dưới đây được hỗ trợ trực tiếp, và hầu hết chúng có thể được cấu hình từ phần CLI Tools của bảng điều khiển thay vì phải sửa các tệp cấu hình thủ công.

- Claude Code
- OpenAI Codex
- Cursor
- Cline
- OpenCode
- Antigravity
- GitHub Copilot
- OpenClaw
- Continue
- RooCode

Với mỗi công cụ, cấu hình là cùng ba giá trị: endpoint `http://localhost:667/v1`, khóa API được sao chép từ bảng điều khiển, và mô hình hoặc combo bạn muốn công cụ đó sử dụng.

---

## Nhà cung cấp được hỗ trợ

Các nhà cung cấp đã kết nối mở ra hơn 800 mô hình qua một endpoint duy nhất. Gọi `GET /v1/models` vào một phiên đang chạy để lấy danh sách chính xác khả dụng cho các kết nối của bạn.

### Nhà cung cấp OAuth

Kết nối bằng cách đăng nhập từ bảng điều khiển. Bansur Router lưu phiên làm việc, tự động làm mới các token của nó, và theo dõi hạn mức của nó.

- Claude Code
- Codex
- GitHub Copilot
- Antigravity
- Gemini
- iFlow
- Windsurf
- Kiro

### Nhà cung cấp miễn phí

Không cần thanh toán để sử dụng các tầng này, điều khiến chúng trở thành cách nhanh nhất để có được yêu cầu đầu tiên thành công.

| Nhà cung cấp | Gói miễn phí cho bạn những gì |
| --- | --- |
| Kiro AI | Khoảng 50 tín dụng mỗi tháng miễn phí, bao gồm Claude 4.5, GLM-5 và MiniMax |
| OpenCode Free | Truy cập không cần xác thực |
| Vertex AI | $300 tín dụng cho các tài khoản Google Cloud mới |

### Nhà cung cấp bằng khóa API

Hơn 40 nhà cung cấp kết nối bằng khóa API, bao gồm các dịch vụ theo phong cách OpenAI và Anthropic cùng nhiều máy chủ mô hình khác nhau. Các lựa chọn chi phí thấp được dùng làm tầng thứ hai thường xuyên nhất là:

| Nhà cung cấp | Giá |
| --- | --- |
| GLM | $0.6 per 1M tokens |
| MiniMax | $0.20 per 1M tokens |
| Kimi | $9 per month flat |

### Nhà cung cấp tự lưu trữ

Bất kỳ endpoint nào sử dụng định dạng tương thích OpenAI đều có thể được kết nối làm nhà cung cấp, vì vậy các mô hình bạn tự phục vụ nằm trong cùng một chuỗi định tuyến — và cùng các combo — như các nhà cung cấp được lưu trữ bên ngoài.

---

## Tham khảo API

Bansur Router mở một API tương thích OpenAI trên endpoint cục bộ của nó. Xác thực bằng khóa API hiển thị trong bảng điều khiển.

### Liệt kê các mô hình

```text
GET /v1/models
```

Trả về mọi mô hình khả dụng trên tất cả các nhà cung cấp đã kết nối của bạn — hơn 800 mô hình sau khi các nhà cung cấp phổ biến được kết nối.

### Tạo một chat completion

```text
POST /v1/chat/completions
Authorization: Bearer <dashboard API key>
```

```bash
curl http://localhost:667/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kr/claude-sonnet-4.5",
    "messages": [
      { "role": "user", "content": "Explain what this function does." }
    ]
  }'
```

Hình thức của yêu cầu và phản hồi tuân theo định dạng chat completions của OpenAI. Bansur Router dịch chúng sang định dạng gốc của bất kỳ nhà cung cấp nào mà chuỗi định tuyến lựa chọn.

Các URL chính trên một cài đặt mặc định:

- Bảng điều khiển: `http://localhost:667/dashboard`
- Cơ sở API: `http://localhost:667/v1`

---

## Hướng dẫn cài đặt

### Chạy bằng Docker

Từ một bản sao (checkout) của kho này:

```bash
docker compose up -d
```

Các image đã phát hành có sẵn dưới dạng `bansur/router` trên Docker Hub và `ghcr.io/mas-ajam/bansur-router` trên GitHub Container Registry. Bảng điều khiển và API được phục vụ trên cổng 667, giống như một cài đặt cục bộ.

### Chạy từ mã nguồn

```bash
cp .env.example .env
npm install
npm run build
PORT=667 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:667 npm run start
```

### Kết nối một nhà cung cấp

1. Khởi động Bansur Router và mở `http://localhost:667/dashboard`.
2. Đi tới **Providers** và chọn **Connect** trên nhà cung cấp bạn muốn.
3. Với các nhà cung cấp OAuth, hoàn tất việc đăng nhập trong cửa sổ mở ra. Với các nhà cung cấp bằng khóa API, dán khóa do nhà cung cấp đó cấp.
4. Gửi một yêu cầu. Hạn mức và mức sử dụng của nhà cung cấp xuất hiện trong bảng điều khiển khi các yêu cầu được định tuyến.

Bắt đầu với một nhà cung cấp miễn phí nếu bạn chỉ muốn kiểm tra việc cài đặt: cả Kiro AI và OpenCode Free đều hoạt động mà không cần gói trả phí.

### Xây dựng một combo

Một combo là một danh sách có thứ tự các mô hình được xử lý như một mô hình duy nhất có thể chọn. Đặt mô hình đăng ký của bạn lên đầu, một mô hình rẻ ở vị trí thứ hai, và một mô hình miễn phí ở cuối, rồi chọn combo đó trong công cụ của bạn. Khi mô hình đầu tiên không khả dụng — cạn hạn mức, bị giới hạn tốc độ, hoặc gặp lỗi — yêu cầu tự động chuyển sang mục tiếp theo.

### Thay đổi cổng

Cổng 667 là giá trị mặc định, không phải yêu cầu bắt buộc.

```bash
bansur-router --port 8080
```

Dạng ngắn `-p` cũng hoạt động, và biến môi trường `PORT` đặt cổng cho các triển khai từ mã nguồn, Docker và máy chủ. Nếu bạn thay đổi cổng, hãy cập nhật endpoint trong các công cụ của bạn cho khớp, ví dụ `http://localhost:8080/v1`. Tách riêng cổng cũng là cách đơn giản nhất để chạy Bansur Router cùng với một dịch vụ cục bộ khác đã chiếm cổng 667.

---

## Câu hỏi thường gặp

### Bansur Router là gì?

Một cổng AI cục bộ cho các công cụ lập trình. Nó đặt một endpoint tương thích OpenAI duy nhất trước tất cả các nhà cung cấp AI của bạn và định tuyến mỗi yêu cầu tới nhà cung cấp khả dụng tốt nhất, để các công cụ của bạn giữ một cấu hình duy nhất trong khi các nhà cung cấp, tài khoản và hạn mức thay đổi phía sau nó.

### Nó có miễn phí không?

Có. Bansur Router tự nó miễn phí và là mã nguồn mở theo giấy phép MIT. Chi phí của một yêu cầu phụ thuộc vào nhà cung cấp mà nó được định tuyến tới: các tầng miễn phí như Kiro AI và OpenCode Free không tốn chi phí gì, và với phần còn lại, bạn tự mang theo gói đăng ký và khóa API của mình và trả trực tiếp cho các nhà cung cấp đó, đúng như khi không có cổng này.

### Dữ liệu của tôi nằm ở đâu?

Trên máy của bạn. Bansur Router ưu tiên cục bộ: các khóa nhà cung cấp được lưu cục bộ, các yêu cầu được định tuyến từ chính cài đặt của bạn, và công việc của cổng là chuyển tiếp chúng tới nhà cung cấp bạn đã chọn. Không cần tạo tài khoản riêng nào trước yêu cầu đầu tiên.

### Nó dùng cổng nào?

667 theo mặc định, cho cả bảng điều khiển và API. Thay đổi nó bằng `--port` (hoặc `-p`) khi khởi động CLI, hoặc bằng biến môi trường `PORT`.

### Nó hoạt động với những công cụ nào?

Claude Code, OpenAI Codex, Cursor, Cline, OpenCode, Antigravity, GitHub Copilot, OpenClaw, Continue và RooCode được hỗ trợ trực tiếp. Bất kỳ công cụ nào khác cho phép bạn đặt một endpoint tương thích OpenAI tùy chỉnh cùng khóa API đều có thể dùng nó với cùng ba giá trị đó.

### Lưu ý cho người dùng Windows

Dừng phiên Bansur Router đang chạy trước khi cập nhật gói npm toàn cục. Windows khóa các tệp của một cài đặt đang chạy, vì vậy một lần cập nhật được thực hiện trong khi cổng vẫn đang chạy sẽ thất bại cho đến khi tiến trình được dừng lại.

---

## Khắc phục sự cố

### Cổng đã bị sử dụng

Có thứ gì đó trên máy của bạn đang lắng nghe trên cổng 667, thường là một tiến trình Bansur Router trước đó vẫn đang chạy. Dừng tiến trình đó, hoặc khởi động trên một cổng khác và trỏ các công cụ của bạn tới đó:

```bash
bansur-router --port 8080
```

### Một nhà cung cấp không kết nối được

Kết nối lại nó từ bảng điều khiển: **Providers → Connect** cho nhà cung cấp đó, và hoàn tất lại việc đăng nhập hoặc nhập khóa. Một kết nối mới sẽ thay thế phiên đã lưu, và việc tự động làm mới token giữ nó hợp lệ từ đó về sau.

### Cập nhật thất bại trên Windows

Dừng phiên đang chạy trước, rồi chạy lại bản cập nhật. Một cài đặt đang chạy sẽ khóa các tệp chương trình của chính nó trên Windows, điều này ngăn gói npm toàn cục bị thay thế.

### Yêu cầu thất bại sau khi thay đổi cổng

Công cụ của bạn vẫn đang trỏ tới địa chỉ cũ. Cập nhật endpoint của nó sang cổng mới — ví dụ `http://localhost:8080/v1` — và xác nhận khóa API là khóa hiển thị trong bảng điều khiển của phiên hiện đang chạy.

---

## Hỗ trợ

Báo cáo lỗi và yêu cầu tính năng qua [GitHub Issues](https://github.com/mas-ajam/bansur-router/issues) trên kho `mas-ajam/bansur-router`. Hãy kèm theo phiên bản bạn đang chạy, cách Bansur Router được khởi động (npm, Docker, hoặc mã nguồn), và nhật ký yêu cầu liên quan khi có vấn đề về định tuyến.

Tài liệu đầy đủ tại [bansur-router.pages.dev](https://bansur-router.pages.dev).

---

## Giấy phép

Bansur Router được phát hành theo [Giấy phép MIT](../LICENSE).

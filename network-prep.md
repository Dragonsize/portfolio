# TỔNG ÔN THI NHÁNH MẠNG (Network Interview Prep)

## 1. MÔ HÌNH OSI & TCP/IP (★★★★★)

**OSI 7 tầng (từ dưới lên):**
- L1 Vật lý: cáp, tín hiệu, bit
- L2 Liên kết dữ liệu: **MAC address**, frame, switch
- L3 Mạng: **IP address**, gói tin, router
- L4 Vận chuyển: **TCP/UDP**, port
- L5-7: Session/Presentation/Application (HTTP, DNS, TLS)

**TCP/IP:** Network Access (L1-2) → Internet (L3) → Transport (L4) → Application (L5-7)

**MAC vs IP:** MAC = địa chỉ phần cứng (nhà sản xuất, dùng trong LAN), IP = địa chỉ logic (định tuyến, toàn cầu).

---

## 2. SUBNETTING (★★★★★)

| CIDR | Subnet mask | Số host | Dùng cho |
|------|-------------|---------|----------|
| /24 | 255.255.255.0 | 254 | 1 mạng nhỏ |
| /26 | 255.255.255.192 | 62 | chia 4 mạng /24 |
| /16 | 255.255.0.0 | 65534 | mạng lớn |
| /20 | 255.255.240.0 | 4094 | chia subnet lớp B |

**Công thức:** Số bit host = 32 - CIDR. Số địa chỉ = 2^(bit host). Host dùng được = tổng - 2 (trừ network + broadcast).

**Ví dụ 192.168.10.0/26:**
- Mask: 255.255.255.192
- Block size: 64 (256-192)
- Mạng: 192.168.10.0 | Broadcast: 192.168.10.63
- Dùng được: 192.168.10.1 → 192.168.10.62

**Mẹo nhanh /26:** các mạng cách nhau 64: .0, .64, .128, .192

---

## 3. TCP HANDSHAKE (★★★★★)

```
Client                Server
  SYN      ────────>
           <──────── SYN/ACK
  ACK      ────────>
```
- **SYN**: xin bắt đầu | **ACK**: xác nhận | **FIN**: đóng | **RST**: reset
- **UDP**: không kết nối, nhanh, dùng DNS/streaming/video

**Câu hỏi hay gặp:** Tại sao DNS dùng UDP?
→ UDP nhẹ, mô hình request/response nhanh trên port 53. Dùng TCP khi zone transfer hoặc gói quá lớn.

---

## 4. TROUBLESHOOTING (★★★★★)

**Thứ tự từ dưới lên:**
```
Vật lý → Link → IP config → Gateway → Routing → DNS → Ứng dụng
```

**Kịch bản hay thi:**
- Ping được 8.8.8.8 nhưng không ping được google.com? → Lỗi **DNS** (không phân giải tên miền).
- Ping được gateway nhưng không ra IP ngoài? → Lỗi **routing/NAT/DNS** phía trên.
- Không có mạng? → Kiểm tra vật lý → `ip addr` → gateway → DNS.

**Lệnh Linux:**
`ip addr` (IP), `ip route` (bảng routing), `ping`, `traceroute`, `dig`/`nslookup` (DNS), `ss` (socket), `tcpdump` (bắt gói)

**Windows:** `ipconfig /all`, `ping`, `tracert`, `arp -a`, `route print`

**Cisco:** `show ip int brief`, `show ip route`, `show arp`, `show mac address-table`, `show vlan brief`

---

## 5. SWITCHING & VLAN (★★★★★)

- **Hub**: broadcast mù quáng (1 collision domain)
- **Switch**: học MAC qua **MAC table**, chuyển frame đúng cổng (mỗi cổng = 1 collision domain, cả switch = 1 broadcast domain)
- **VLAN**: chia broadcast domain logic
- **Access port**: 1 VLAN
- **Trunk port** (802.1Q): chở nhiều VLAN, gắn tag
- **Inter-VLAN routing**: router/L3 switch để các VLAN nói chuyện
- **STP**: chống loop

**Switch học MAC:** PC A gửi frame → switch xem MAC nguồn → ghi vào bảng → xem MAC đích → nếu biết thì forward đúng cổng, không biết thì flood.

---

## 6. ROUTING (★★★★★)

- **Bảng routing**: đích mạng → next-hop → exit interface
- **Default route**: 0.0.0.0/0 (đường ra Internet)
- **Longest-prefix match**: chọn route khớp dài nhất
- **AD** (Administrative Distance): độ tin cậy (Static = 1, OSPF = 110, BGP eBGP = 20)
- **OSPF**: thuật toán link-state, nội bộ (IGP)
- **BGP**: giữa các AS, Internet

---

## 7. DNS & DHCP (★★★★☆)

**DNS hierarchy:** `.` → `com` → `google` → `www`

**Record:** A (IPv4), AAAA (IPv6), CNAME (bí danh), MX (mail), NS (name server), TXT, PTR (ngược)

**DHCP DORA:**
```
Discover → Offer → Request → ACK
```
- Lease, Scope, Reservation, DHCP Relay (cần khi qua router)

---

## 8. BẢO MẬT (★★★★☆)

- **Firewall**: lọc theo rule | **ACL**: danh sách quyền trên router
- **IDS** (phát hiện) vs **IPS** (chặn luôn)
- **VLAN/Segmentation**: cô lập người dùng và server
- **NAT**: ẩn IP private ra public
- **VPN/TLS**: mã hóa
- Tấn công: port scan, ARP spoofing, DNS spoofing, MAC flooding, DDoS

---

## 9. CÂU HỎI CHẮC CHẮN BỊ HỎI

1. Điều gì xảy ra khi gõ google.com? → DNS → routing → TCP/TLS → HTTP → trả về
2. Switch vs Router?
3. TCP vs UDP?
4. ARP là gì? (map IP → MAC)
5. DHCP DORA?
6. DNS là gì?
7. VLAN / trunk là gì?
8. NAT là gì?
9. Default gateway?
10. Hub vs Switch vs Router?
11. MAC vs IP?
12. Tại sao ping 8.8.8.8 được mà google.com không?

---

## 10. ĐÁP ÁN CHI TIẾT 12 CÂU HỎI

### 1. Điều gì xảy ra khi gõ google.com vào trình duyệt?
```
1. DNS resolution:  trình duyệt hỏi resolver → root → TLD(com) → authoritative
                     → nhận được IP (vd 142.250.1.1)
2. ARP:             nếu chưa có MAC của gateway, gửi ARP để lấy MAC
3. Routing:         kiểm tra bảng routing, gói đi ra default gateway (0.0.0.0/0)
4. TCP handshake:   Client SYN → Server SYN/ACK → Client ACK (port 443)
5. TLS handshake:    thỏa thuận khóa mã hóa (HTTPS)
6. HTTP request:     gửi GET / qua TLS
7. Server phản hồi:  trả HTML → trình duyệt render
8. Kết nối đóng:     FIN/ACK hoặc keep-alive
```

### 2. Switch vs Router?
- **Switch**: Thiết bị L2, chuyển tiếp frame dựa trên **MAC address** trong cùng 1 mạng (LAN). Không định tuyến giữa các mạng khác nhau.
- **Router**: Thiết bị L3, định tuyến gói tin giữa các mạng khác nhau dựa trên **IP address**. Kết nối LAN với WAN/Internet.

### 3. TCP vs UDP?
| | TCP | UDP |
|---|---|---|
| Kết nối | Có (3-way handshake) | Không (connectionless) |
| Tin cậy | Có (ACK, retransmission) | Không (best-effort) |
| Tốc độ | Chậm hơn | Nhanh, nhẹ |
| Dùng cho | Web, email, file | DNS, video, game, VoIP |

### 4. ARP là gì?
- **Address Resolution Protocol** — map **IP → MAC** trong cùng mạng LAN.
- Khi PC muốn gửi gói đến IP trong cùng subnet nhưng chưa biết MAC, nó broadcast "Ai có IP này?" → máy sở hữu trả lời unicast.
- Lưu vào **ARP cache** (`arp -a`).

### 5. DHCP DORA?
```
Discover  PC broadcast tìm DHCP server
Offer     Server gửi đề xuất IP + config
Request   PC xác nhận nhận IP đó
ACK       Server xác nhận chính thức
```
Cấp: IP, subnet mask, default gateway, DNS server, lease time.

### 6. DNS là gì?
- **Domain Name System** — dịch tên miền (google.com) → IP.
- Phân cấp: `.` → `com` → `google` → `www`
- Loại record: A (IPv4), AAAA (IPv6), CNAME, MX, NS, TXT, PTR.
- Recursive resolver hỏi authoritative server để phân giải.

### 7. VLAN / trunk là gì?
- **VLAN**: chia broadcast domain logic trên cùng 1 switch vật lý (vd VLAN 10 = users, VLAN 20 = servers). Cô lập traffic.
- **Access port**: thuộc 1 VLAN, nối đến PC.
- **Trunk port** (802.1Q): nối switch-switch/router, chở **nhiều VLAN**, gắn tag VLAN ID vào frame.
- **Inter-VLAN routing**: cần router hoặc L3 switch để các VLAN giao tiếp.

### 8. NAT là gì?
- **Network Address Translation** — đổi IP nguồn (private → public) khi ra Internet và ngược lại khi về.
- Giúp tiết kiệm IPv4, ẩn mạng nội bộ.
- Loại: Static NAT, Dynamic NAT, **PAT/NAPT** (nhiều IP private qua 1 IP public nhờ port).

### 9. Default gateway?
- IP của router trong mạng local — "cửa ra" để đến mạng khác / Internet.
- Khi đích không cùng subnet, gói được gửi đến default gateway.
- Vd: PC 192.168.1.10/24 gửi ra ngoài → qua 192.168.1.1 (gateway).

### 10. Hub vs Switch vs Router?
- **Hub**: L1, broadcast mù quáng mọi cổng, 1 collision domain → chậm, lỗi.
- **Switch**: L2, học MAC, forward đúng cổng, mỗi cổng = 1 collision domain.
- **Router**: L3, nối các mạng khác nhau, định tuyến bằng IP.

### 11. MAC vs IP?
- **MAC**: địa chỉ phần cứng (48-bit, do nhà sản xuất gán), dùng trong LAN, không đổi.
- **IP**: địa chỉ logic (32-bit IPv4), dùng định tuyến toàn cầu, thay đổi theo mạng.
- MAC đổi khi ra khỏi LAN, IP đổi khi qua router.

### 12. Tại sao ping 8.8.8.8 được mà google.com không?
- `8.8.8.8` là IP → không cần DNS, chỉ cần IP config + routing đúng là ping được.
- `google.com` cần **phân giải DNS** → nếu DNS server sai/hỏng/chưa cấu hình → không dịch được tên → lỗi "could not resolve".
- → Lỗi nằm ở **tầng DNS**, không phải kết nối mạng. Kiểm tra `/etc/resolv.conf` hoặc `ipconfig /all` (DNS server).

---

## CHIẾN THUẬT ÔN TẬP (2 tiếng)

1. (40p) Subnetting — luyện /24, /26, /16, /20 tính nhẩm
2. (30p) TCP handshake + OSI + thứ tự troubleshooting
3. (30p) Đọc to 12 câu hỏi trên thành tiếng Việt
4. (20p) VLAN/trunk + DNS/DHCP DORA

**Sai lầm chết người:** học thuộc lệnh Cisco mà không giải thích được tại sao gói tin đến được / không đến được.

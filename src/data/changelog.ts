
export interface ChangelogEntry {
    version: string;
    date: string;
    changes: string[];
}

export const CHANGELOG_DATA: ChangelogEntry[] = [
    {
        version: "v0.4.7",
        date: "2024-06-02",
        changes: [
            "🛡️ [GraphRAG] Tích hợp sâu rộng mạng lưới quan hệ thực thể GraphRAG trực tiếp vào Context Window của hệ thống prompt builder.",
            "🧠 [MCE Core] Ổn định hóa hệ thống Đồng hóa Ký ức đa tầng (Memory Consolidation Engine) tự động dung hòa StoryBible, Vector RAG và dữ liệu đồ thị.",
            "🪐 [UI/UX] Nâng cấp giao diện Thư Khố Vũ Trụ thành Mô hình Chòm sao mạng lưới 3D Constellation liên kết lấp lánh.",
            "📜 [UI] Tích hợp bảng hiển thị Lịch sử cập nhật động (Dynamic Changelog Hub) trực tiếp vào Phòng Thông tin của Sảnh chính."
        ]
    },
    {
        version: "v0.4.6",
        date: "2024-05-30",
        changes: [
            "🏗️ [GraphRAG Service] Hoàn thiện hệ cơ sở hạ tầng lưu trữ và liên kết Node/Edge trong lòng IndexedDB cục bộ.",
            "⚙️ [StoryBible] Chuẩn hóa vòng lặp tự động nén và trích xuất thông tin bối cảnh dã sử sau mỗi 10 lượt hội thoại."
        ]
    },
    {
        version: "v0.4.5",
        date: "2024-05-26",
        changes: [
            "🛡️ [Security] Bổ sung xác thực auth middleware bằng x-ark-client header cho proxy server.",
            "⚡ [Performance] Tối ưu hóa kiến trúc Hybrid AI: Chạy song song Background Agent (nhanh) và Vector Retrieval để giảm thiểu độ trễ.",
            "🛠️ [System] Dọn dẹp source code và thay thế toàn bộ Math.random() ID thành chuẩn crypto.randomUUID()."
        ]
    },
    {
        version: "v0.4.4",
        date: "2024-05-25",
        changes: [
            "💉 [AI Core] Thêm cơ chế 'Anti-Lazy Injection' để ngăn chặn hiện tượng AI viết ngắn dần sau nhiều lượt chat.",
            "🔄 [System] Tích hợp Style Reinforcement ngẫu nhiên vào mỗi lượt để duy trì chất lượng văn phong.",
            "🛠️ [Fix] Sửa lỗi Context Drift (trôi ngữ cảnh) khi hội thoại kéo dài."
        ]
    },
    {
        version: "v0.4.3",
        date: "2024-05-24",
        changes: [
            "✨ [World Creation] Thêm trường 'Kịch bản khởi đầu' (Starting Scenario) cho phép người chơi tùy chỉnh tình huống mở đầu game.",
            "📜 [Main Menu] Thêm mục 'Lịch sử cập nhật' (Version History) để theo dõi thay đổi.",
            "🧠 [AI Core] Tích hợp Vector RAG (Retrieval-Augmented Generation) để AI ghi nhớ các sự kiện quá khứ tốt hơn.",
            "🤖 [System] Tối ưu hóa logic xử lý LSR (Lorebook System) và Tawa Modules.",
            "🐛 [Fix] Sửa lỗi hiển thị Markdown trong chế độ Stream."
        ]
    },
    {
        version: "v0.4.2",
        date: "2024-05-20",
        changes: [
            "✨ [Gameplay] Thêm tính năng LSR (Lorebook Status Record) hiển thị bảng trạng thái động.",
            "🎨 [UI] Cải thiện giao diện hiển thị tin nhắn và các tùy chọn hành động.",
            "🚀 [System] Nâng cấp IndexedDB lên version 2 để hỗ trợ lưu trữ Vector.",
            "🧠 [AI] Cập nhật Preset Tawa Ultimate cho chất lượng văn phong tốt hơn."
        ]
    },
    {
        version: "v0.4.1",
        date: "2024-05-15",
        changes: [
            "✨ [Gameplay] Thêm tính năng Streaming Response (phản hồi từng chữ).",
            "🔧 [Settings] Thêm tùy chọn Thinking Budget cho Model Gemini 3.0 Pro.",
            "🐛 [Fix] Sửa lỗi tràn bộ nhớ khi lịch sử chat quá dài."
        ]
    },
    {
        version: "v0.4.0",
        date: "2024-05-01",
        changes: [
            "🎉 [Release] Phát hành phiên bản Ark v2 SillyTavern Alpha.",
            "✨ [Core] Hệ thống kiến tạo thế giới và nhân vật cơ bản.",
            "💾 [System] Hỗ trợ lưu trữ cục bộ (Local Storage/IndexedDB)."
        ]
    }
];

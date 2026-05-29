import SwiftUI
import AVFoundation

// MARK: - Models

struct WordItem: Identifiable, Hashable {
    let id = UUID()
    let word: String
    let rank: Int
    let level: Int
}

struct WordProgress: Codable {
    var isStarred: Bool = false
    var isMastered: Bool = false
}

// Codable structs for Dictionary API
struct DictionaryEntry: Codable, Hashable {
    let word: String
    let phonetic: String?
    let phonetics: [Phonetic]?
    let meanings: [Meaning]?
    
    static func == (lhs: DictionaryEntry, rhs: DictionaryEntry) -> Bool {
        return lhs.word == rhs.word
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(word)
    }
}

struct Phonetic: Codable, Hashable {
    let text: String?
    let audio: String?
}

struct Meaning: Codable, Hashable {
    let partOfSpeech: String
    let definitions: [Definition]?
}

struct Definition: Codable, Hashable {
    let definition: String
    let example: String?
}

// MARK: - App State / ViewModel

class AppState: ObservableObject {
    @Published var words: [WordItem] = []
    @Published var starredWords: [String: Bool] = [:]
    @Published var masteredWords: [String: Bool] = [:]
    @Published var recentWords: [String] = []
    @Published var streak: Int = 0
    @Published var lastStudyDate: String = ""
    
    // Settings
    @Published var voiceSpeed: Double = 0.9 {
        didSet { UserDefaults.standard.set(voiceSpeed, forKey: "toeic_voice_speed") }
    }
    @Published var voiceAccent: String = "en-US" {
        didSet { UserDefaults.standard.set(voiceAccent, forKey: "toeic_voice_accent") }
    }
    @Published var dailyGoal: Int = 20 {
        didSet { UserDefaults.standard.set(dailyGoal, forKey: "toeic_daily_goal") }
    }
    
    // Active Detail Word modal state
    @Published var activeDetailWord: String? = nil
    
    private let synthesizer = AVSpeechSynthesizer()
    
    init() {
        // Load settings
        self.voiceSpeed = UserDefaults.standard.double(forKey: "toeic_voice_speed") == 0 ? 0.9 : UserDefaults.standard.double(forKey: "toeic_voice_speed")
        self.voiceAccent = UserDefaults.standard.string(forKey: "toeic_voice_accent") ?? "en-US"
        self.dailyGoal = UserDefaults.standard.integer(forKey: "toeic_daily_goal") == 0 ? 20 : UserDefaults.standard.integer(forKey: "toeic_daily_goal")
        
        // Load lists from UserDefaults
        self.starredWords = UserDefaults.standard.dictionary(forKey: "toeic_starred_words") as? [String: Bool] ?? [:]
        self.masteredWords = UserDefaults.standard.dictionary(forKey: "toeic_mastered_words") as? [String: Bool] ?? [:]
        self.recentWords = UserDefaults.standard.stringArray(forKey: "toeic_recent_words") ?? []
        self.streak = UserDefaults.standard.integer(forKey: "toeic_streak")
        self.lastStudyDate = UserDefaults.standard.string(forKey: "toeic_last_study_date") ?? ""
        
        // Load words
        self.words = loadWordsList()
    }
    
    func getLevelName(_ level: Int) -> String {
        switch level {
        case 1: return "基礎奠基 (Essential)"
        case 2: return "核心高頻 (Core)"
        case 3: return "進階挑戰 (Intermediate)"
        case 4: return "高分衝刺 (Advanced)"
        default: return ""
        }
    }
    
    func getLevelRange(_ level: Int) -> String {
        switch level {
        case 1: return "1 - 1500"
        case 2: return "1501 - 4000"
        case 3: return "4001 - 6500"
        case 4: return "6501 - 9000"
        default: return ""
        }
    }
    
    private func loadWordsList() -> [WordItem] {
        let paths = [
            "docs/toeic_9000_words.txt",
            "../docs/toeic_9000_words.txt",
            "../../docs/toeic_9000_words.txt",
            "/Users/jeff/Documents/repos/TOEIC-9000/docs/toeic_9000_words.txt"
        ]
        
        for path in paths {
            if let content = try? String(contentsOfFile: path, encoding: .utf8) {
                let lines = content.components(separatedBy: .newlines)
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                
                return lines.enumerated().map { (index, word) in
                    let rank = index + 1
                    let level: Int
                    if index < 1500 { level = 1 }
                    else if index < 4000 { level = 2 }
                    else if index < 6500 { level = 3 }
                    else { level = 4 }
                    
                    return WordItem(word: word, rank: rank, level: level)
                }
            }
        }
        
        // Fallback words if file not found
        return [
            WordItem(word: "connection", rank: 1, level: 1),
            WordItem(word: "coordinate", rank: 2, level: 1),
            WordItem(word: "evaluate", rank: 3, level: 1),
            WordItem(word: "implement", rank: 4, level: 1),
            WordItem(word: "establish", rank: 5, level: 1)
        ]
    }
    
    func speak(_ text: String) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = Float(voiceSpeed) * AVSpeechUtteranceDefaultSpeechRate
        utterance.voice = AVSpeechSynthesisVoice(language: voiceAccent)
        synthesizer.speak(utterance)
    }
    
    func toggleStar(for word: String) {
        if starredWords[word] == true {
            starredWords[word] = nil
        } else {
            starredWords[word] = true
        }
        saveStarredWords()
    }
    
    func toggleMastery(for word: String) {
        if masteredWords[word] == true {
            masteredWords[word] = nil
        } else {
            masteredWords[word] = true
            addRecentWord(word)
        }
        saveMasteredWords()
    }
    
    func addRecentWord(_ word: String) {
        var list = recentWords.filter { $0 != word }
        list.insert(word, at: 0)
        if list.count > 10 {
            list = Array(list.prefix(10))
        }
        recentWords = list
        UserDefaults.standard.set(recentWords, forKey: "toeic_recent_words")
        recordStudyActivity()
    }
    
    func recordStudyActivity() {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let today = formatter.string(from: Date())
        
        if lastStudyDate == today { return }
        
        var newStreak = streak
        if !lastStudyDate.isEmpty {
            if let lastDate = formatter.date(from: lastStudyDate) {
                let calendar = Calendar.current
                let diff = calendar.dateComponents([.day], from: lastDate, to: Date())
                if diff.day == 1 {
                    newStreak += 1
                } else if diff.day ?? 0 > 1 {
                    newStreak = 1
                }
            }
        } else {
            newStreak = 1
        }
        
        streak = newStreak
        lastStudyDate = today
        
        UserDefaults.standard.set(streak, forKey: "toeic_streak")
        UserDefaults.standard.set(lastStudyDate, forKey: "toeic_last_study_date")
    }
    
    func resetProgress() {
        starredWords = [:]
        masteredWords = [:]
        recentWords = []
        streak = 0
        lastStudyDate = ""
        
        UserDefaults.standard.removeObject(forKey: "toeic_starred_words")
        UserDefaults.standard.removeObject(forKey: "toeic_mastered_words")
        UserDefaults.standard.removeObject(forKey: "toeic_recent_words")
        UserDefaults.standard.removeObject(forKey: "toeic_streak")
        UserDefaults.standard.removeObject(forKey: "toeic_last_study_date")
    }
    
    private func saveStarredWords() {
        UserDefaults.standard.set(starredWords, forKey: "toeic_starred_words")
    }
    
    private func saveMasteredWords() {
        UserDefaults.standard.set(masteredWords, forKey: "toeic_mastered_words")
    }
    
    // Fetch Dictionary Data (Free Dictionary API)
    func fetchDefinition(for word: String, completion: @escaping (Result<DictionaryEntry, Error>) -> Void) {
        guard let url = URL(string: "https://api.dictionaryapi.dev/api/v2/entries/en/\(word)") else {
            completion(.failure(URLError(.badURL)))
            return
        }
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(URLError(.zeroByteResource)))
                return
            }
            
            do {
                let decoder = JSONDecoder()
                let entries = try decoder.decode([DictionaryEntry].self, from: data)
                if let firstEntry = entries.first {
                    completion(.success(firstEntry))
                } else {
                    completion(.failure(URLError(.badServerResponse)))
                }
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}

// MARK: - Views

// Global Detail Modal / View
struct WordDetailView: View {
    let word: String
    @ObservedObject var state: AppState
    @State private var entry: DictionaryEntry? = nil
    @State private var loading = true
    @State private var errorMsg: String? = nil
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(word)
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                    
                    HStack(spacing: 12) {
                        if let phonetic = entry?.phonetic {
                            Text(phonetic)
                                .font(.system(.body, design: .monospaced))
                                .foregroundColor(.accentColor)
                        }
                        if let wordsIndex = state.words.firstIndex(where: { $0.word == word }) {
                            Text("RANK #\(wordsIndex + 1)")
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.secondary.opacity(0.15))
                                .cornerRadius(6)
                        }
                    }
                }
                Spacer()
                Button(action: { state.speak(word) }) {
                    Image(systemName: "volume.3.fill")
                        .font(.title2)
                }
                .buttonStyle(.plain)
                .padding(8)
                .background(Circle().fill(Color.accentColor.opacity(0.1)))
            }
            .padding()
            
            Divider()
            
            // Body
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if loading {
                        VStack(spacing: 12) {
                            ProgressView()
                            Text("載入釋義中...")
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                    } else if let errorMsg = errorMsg {
                        VStack(spacing: 12) {
                            Image(systemName: "info.circle")
                                .font(.largeTitle)
                                .foregroundColor(.orange)
                            Text(errorMsg)
                                .multilineTextAlignment(.center)
                            
                            Link("在網頁上查詢劍橋詞典", destination: URL(string: "https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/\(word)")!)
                                .font(.headline)
                                .padding(.top, 10)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 30)
                    } else if let meanings = entry?.meanings {
                        ForEach(meanings, id: \.self) { meaning in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(meaning.partOfSpeech)
                                    .font(.subheadline)
                                    .fontWeight(.bold)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color.purple.opacity(0.15))
                                    .foregroundColor(.purple)
                                    .cornerRadius(6)
                                
                                ForEach(meaning.definitions ?? [], id: \.self) { def in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(def.definition)
                                            .font(.body)
                                            .foregroundColor(.primary)
                                            .padding(.leading, 4)
                                        
                                        if let example = def.example {
                                            Text("Ex: \(example)")
                                                .font(.subheadline)
                                                .italic()
                                                .foregroundColor(.secondary)
                                                .padding(.leading, 12)
                                                .border(width: 2, edges: [.leading], color: Color.accentColor.opacity(0.3))
                                        }
                                    }
                                    .padding(.bottom, 8)
                                }
                            }
                            .padding(.bottom, 10)
                        }
                    }
                }
                .padding()
            }
            
            Divider()
            
            // Footer Action buttons
            HStack(spacing: 20) {
                Button(action: { state.toggleStar(for: word) }) {
                    HStack {
                        Image(systemName: state.starredWords[word] == true ? "star.fill" : "star")
                        Text(state.starredWords[word] == true ? "已收藏" : "收藏")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(state.starredWords[word] == true ? Color.yellow.opacity(0.15) : Color.clear)
                    .cornerRadius(8)
                }
                .buttonStyle(.bordered)
                .accentColor(state.starredWords[word] == true ? .orange : .secondary)
                
                Button(action: { state.toggleMastery(for: word) }) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                        Text(state.masteredWords[word] == true ? "取消掌握" : "已掌握")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(state.masteredWords[word] == true ? Color.green.opacity(0.15) : Color.clear)
                    .cornerRadius(8)
                }
                .buttonStyle(.borderedProminent)
                .tint(state.masteredWords[word] == true ? .green : .accentColor)
            }
            .padding()
        }
        .frame(width: 450, height: 500)
        .onAppear {
            state.fetchDefinition(for: word) { result in
                DispatchQueue.main.async {
                    self.loading = false
                    switch result {
                    case .success(let data):
                        self.entry = data
                    case .failure:
                        self.errorMsg = "無法下載釋義，請點擊連結前往線上查詢。"
                    }
                }
            }
        }
    }
}

// Helper view modifier for borders
extension View {
    func border(width: CGFloat, edges: [Edge], color: Color) -> some View {
        overlay(EdgeBorder(width: width, edges: edges).foregroundColor(color))
    }
}

struct EdgeBorder: Shape {
    var width: CGFloat
    var edges: [Edge]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        for edge in edges {
            var x: CGFloat { return edge == .leading ? rect.minX : rect.maxX - width }
            var y: CGFloat { return edge == .top ? rect.minY : rect.maxY - width }
            var w: CGFloat { return edge == .leading || edge == .trailing ? width : rect.width }
            var h: CGFloat { return edge == .top || edge == .bottom ? width : rect.height }
            path.addRect(CGRect(x: x, y: y, width: w, height: h))
        }
        return path
    }
}

// MARK: - Subviews: Dashboard

struct DashboardView: View {
    @ObservedObject var state: AppState
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Welcome and Streak Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("多益考試單字大全")
                            .font(.system(.title, design: .rounded))
                            .fontWeight(.bold)
                        Text("TOEIC 9000 核心高頻單字學習系統")
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    
                    // Streak badge
                    HStack(spacing: 8) {
                        Image(systemName: "flame.fill")
                            .foregroundColor(.red)
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 0) {
                            Text("連續學習")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("\(state.streak) 天")
                                .fontWeight(.bold)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(12)
                }
                
                // Stats Summary Cards
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    // Mastered card
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundColor(.green)
                                .font(.title)
                            Spacer()
                            Text("\(Double(state.masteredWords.count) / 9000.0 * 100.0, specifier: "%.1f")%")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        Text("\(state.masteredWords.count) / 9000")
                            .font(.title2)
                            .fontWeight(.bold)
                        Text("已掌握單字量")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.secondary.opacity(0.06))
                    .cornerRadius(16)
                    
                    // Starred card
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                            .font(.title)
                        Text("\(state.starredWords.count)")
                            .font(.title2)
                            .fontWeight(.bold)
                        Text("已收藏單字量")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.secondary.opacity(0.06))
                    .cornerRadius(16)
                    
                    // Daily Goal progress
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "flag.fill")
                            .foregroundColor(.purple)
                            .font(.title)
                        Text("\(state.recentWords.count) / \(state.dailyGoal)")
                            .font(.title2)
                            .fontWeight(.bold)
                        Text("今日背誦目標")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.secondary.opacity(0.06))
                    .cornerRadius(16)
                }
                
                // Level Progress Section
                VStack(alignment: .leading, spacing: 16) {
                    Text("分級單字掌握進度")
                        .font(.headline)
                    
                    ForEach(1...4, id: \.self) { lvl in
                        let levelWords = state.words.filter { $0.level == lvl }
                        let levelMastered = levelWords.filter { state.masteredWords[$0.word] == true }.count
                        let totalCount = levelWords.isEmpty ? 1 : levelWords.count
                        let pct = Double(levelMastered) / Double(totalCount)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("Lvl \(lvl)：\(state.getLevelName(lvl))")
                                    .fontWeight(.semibold)
                                Spacer()
                                Text("\(levelMastered) / \(totalCount) (\(Int(pct * 100))%)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            ProgressView(value: pct)
                                .accentColor(.accentColor)
                        }
                        .padding(.vertical, 4)
                    }
                }
                .padding()
                .background(Color.secondary.opacity(0.03))
                .cornerRadius(16)
                
                // Recent activity list
                VStack(alignment: .leading, spacing: 12) {
                    Text("最近熟背單字 (Recently Mastered)")
                        .font(.headline)
                    
                    if state.recentWords.isEmpty {
                        Text("尚未有近期的背單字紀錄。快點擊「字卡學習」開始吧！")
                            .foregroundColor(.secondary)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .center)
                    } else {
                        ForEach(state.recentWords.prefix(5), id: \.self) { word in
                            HStack {
                                Text(word)
                                    .fontWeight(.bold)
                                    .font(.system(.body, design: .rounded))
                                Spacer()
                                Button("查詢釋義") {
                                    state.activeDetailWord = word
                                }
                                .buttonStyle(.link)
                            }
                            .padding(.vertical, 8)
                            .padding(.horizontal, 12)
                            .background(Color.secondary.opacity(0.05))
                            .cornerRadius(8)
                        }
                    }
                }
            }
            .padding(24)
        }
    }
}

// MARK: - Subviews: Dictionary / Search

struct DictionaryView: View {
    @ObservedObject var state: AppState
    @State private var query = ""
    @State private var filterLevel = "all"
    @State private var filterStatus = "all"
    
    // Lazy filter words
    var filteredWords: [WordItem] {
        state.words.filter { item in
            let matchQuery = query.isEmpty ? true : item.word.contains(query.lowercased().trimmingCharacters(in: .whitespaces))
            
            let matchLevel: Bool
            if filterLevel == "all" { matchLevel = true }
            else { matchLevel = item.level == Int(filterLevel) }
            
            let matchStatus: Bool
            switch filterStatus {
            case "starred": matchStatus = state.starredWords[item.word] == true
            case "mastered": matchStatus = state.masteredWords[item.word] == true
            case "unmastered": matchStatus = state.masteredWords[item.word] != true
            default: matchStatus = true
            }
            
            return matchQuery && matchLevel && matchStatus
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Search toolbar
            HStack(spacing: 16) {
                // Search bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("搜尋多益核心單字...", text: $query)
                        .textFieldStyle(.plain)
                    if !query.isEmpty {
                        Button(action: { query = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(8)
                .background(Color.secondary.opacity(0.1))
                .cornerRadius(8)
                .frame(maxWidth: 350)
                
                // Level selector
                Picker("級別：", selection: $filterLevel) {
                    Text("所有難度分級").tag("all")
                    Text("Level 1 (基礎)").tag("1")
                    Text("Level 2 (核心)").tag("2")
                    Text("Level 3 (進階)").tag("3")
                    Text("Level 4 (高分)").tag("4")
                }
                .frame(width: 160)
                
                // Status selector
                Picker("學習狀態：", selection: $filterStatus) {
                    Text("所有單字").tag("all")
                    Text("僅已收藏").tag("starred")
                    Text("僅已掌握").tag("mastered")
                    Text("僅未掌握").tag("unmastered")
                }
                .frame(width: 160)
            }
            .padding()
            .background(Color.secondary.opacity(0.02))
            
            Divider()
            
            // List of words
            List {
                ForEach(filteredWords) { item in
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.word)
                                .font(.system(.title3, design: .rounded))
                                .fontWeight(.bold)
                            Text("Level \(item.level)・Rank #\(item.rank)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        // Actions cell
                        HStack(spacing: 12) {
                            Button(action: { state.speak(item.word) }) {
                                Image(systemName: "volume.3")
                                    .foregroundColor(.secondary)
                            }
                            .buttonStyle(.plain)
                            
                            Button(action: { state.toggleStar(for: item.word) }) {
                                Image(systemName: state.starredWords[item.word] == true ? "star.fill" : "star")
                                    .foregroundColor(state.starredWords[item.word] == true ? .yellow : .secondary)
                            }
                            .buttonStyle(.plain)
                            
                            Button(action: { state.toggleMastery(for: item.word) }) {
                                Image(systemName: state.masteredWords[item.word] == true ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(state.masteredWords[item.word] == true ? .green : .secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 6)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        state.activeDetailWord = item.word
                    }
                }
            }
        }
    }
}

// MARK: - Subviews: Flashcard / Study

struct FlashcardView: View {
    @ObservedObject var state: AppState
    
    @State private var selectedLevel = "1"
    @State private var selectedFilter = "all"
    @State private var isRandom = false
    
    @State private var flashcardsList: [String] = []
    @State private var currentIndex = 0
    @State private var isFlipped = false
    
    // Card dynamic definition status
    @State private var dictData: DictionaryEntry? = nil
    @State private var loading = false
    @State private var errorMsg: String? = nil
    
    var body: some View {
        VStack {
            if flashcardsList.isEmpty {
                // Setup card view
                VStack(spacing: 24) {
                    Image(systemName: "square.grid.3x1.folder.badge.plus")
                        .font(.system(size: 64))
                        .foregroundColor(.accentColor)
                    
                    Text("設定單字記憶卡片")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    VStack(alignment: .leading, spacing: 16) {
                        Picker("單字分級：", selection: $selectedLevel) {
                            Text("所有難度等級").tag("all")
                            Text("Level 1 (基礎奠基 - Essential)").tag("1")
                            Text("Level 2 (核心高頻 - Core)").tag("2")
                            Text("Level 3 (進階挑戰 - Intermediate)").tag("3")
                            Text("Level 4 (高分衝刺 - Advanced)").tag("4")
                        }
                        .frame(width: 320)
                        
                        Picker("狀態過濾：", selection: $selectedFilter) {
                            Text("所有單字").tag("all")
                            Text("僅未掌握 (排除已熟記)").tag("unmastered")
                            Text("僅已收藏單字").tag("starred")
                        }
                        .frame(width: 320)
                        
                        Toggle("隨機打亂單字播放排序", isOn: $isRandom)
                            .padding(.leading, 80)
                    }
                    
                    Button(action: startSession) {
                        Text("開始字卡學習")
                            .font(.headline)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(40)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // Flashcards learning carousel
                let activeWord = flashcardsList[currentIndex]
                
                VStack(spacing: 24) {
                    // Top header stats
                    HStack {
                        Button(action: { flashcardsList = [] }) {
                            HStack {
                                Image(systemName: "arrow.left")
                                Text("結束卡片學習")
                            }
                        }
                        .buttonStyle(.bordered)
                        
                        Spacer()
                        
                        Text("進度: \(currentIndex + 1) / \(flashcardsList.length)")
                            .font(.system(.body, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)
                    
                    // 3D Card
                    ZStack {
                        if !isFlipped {
                            // Card Front
                            VStack(spacing: 24) {
                                Spacer()
                                
                                Text(activeWord)
                                    .font(.system(size: 48, weight: .bold, design: .rounded))
                                
                                if let phonetic = dictData?.phonetic {
                                    Text(phonetic)
                                        .font(.system(.title3, design: .monospaced))
                                        .foregroundColor(.accentColor)
                                }
                                
                                Spacer()
                                
                                HStack(spacing: 20) {
                                    Button(action: { state.speak(activeWord) }) {
                                        Image(systemName: "volume.3.fill")
                                            .font(.title)
                                            .padding()
                                            .background(Circle().fill(Color.accentColor.opacity(0.1)))
                                    }
                                    .buttonStyle(.plain)
                                    
                                    Button(action: { state.toggleStar(for: activeWord) }) {
                                        Image(systemName: state.starredWords[activeWord] == true ? "star.fill" : "star")
                                            .font(.title)
                                            .foregroundColor(state.starredWords[activeWord] == true ? .yellow : .secondary)
                                            .padding()
                                            .background(Circle().fill(Color.secondary.opacity(0.1)))
                                    }
                                    .buttonStyle(.plain)
                                }
                                
                                Text("點擊卡片任何地方以查看釋義")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .padding(.bottom)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(RoundedRectangle(cornerRadius: 24).fill(Color.secondary.opacity(0.05)))
                            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.secondary.opacity(0.15), lineWidth: 1))
                            .shadow(radius: 6)
                        } else {
                            // Card Back
                            VStack(alignment: .leading, spacing: 16) {
                                Text("釋義 (Definitions)")
                                    .font(.headline)
                                    .foregroundColor(.secondary)
                                    .padding(.bottom, 4)
                                
                                if loading {
                                    VStack {
                                        ProgressView()
                                        Text("下載字典釋義中...")
                                            .foregroundColor(.secondary)
                                    }
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                } else if let errorMsg = errorMsg {
                                    VStack {
                                        Image(systemName: "info.circle")
                                            .font(.largeTitle)
                                            .foregroundColor(.orange)
                                        Text(errorMsg)
                                            .multilineTextAlignment(.center)
                                            .padding(.top, 4)
                                        Link("線上查詢劍橋詞典", destination: URL(string: "https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/\(activeWord)")!)
                                            .padding(.top, 8)
                                    }
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                } else if let meanings = dictData?.meanings {
                                    ScrollView {
                                        VStack(alignment: .leading, spacing: 16) {
                                            ForEach(meanings.prefix(2), id: \.self) { meaning in
                                                VStack(alignment: .leading, spacing: 6) {
                                                    Text(meaning.partOfSpeech)
                                                        .font(.caption)
                                                        .fontWeight(.bold)
                                                        .padding(.horizontal, 6)
                                                        .padding(.vertical, 2)
                                                        .background(Color.purple.opacity(0.1))
                                                        .foregroundColor(.purple)
                                                        .cornerRadius(4)
                                                    
                                                    ForEach(meaning.definitions?.prefix(2) ?? [], id: \.self) { def in
                                                        Text(def.definition)
                                                            .font(.body)
                                                        if let ex = def.example {
                                                            Text("例: \(ex)")
                                                                .font(.subheadline)
                                                                .foregroundColor(.secondary)
                                                                .italic()
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                }
                                
                                Spacer()
                                
                                Text("點擊卡片翻回正面")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .frame(maxWidth: .infinity, alignment: .center)
                            }
                            .padding(32)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(RoundedRectangle(cornerRadius: 24).fill(Color.secondary.opacity(0.05)))
                            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.secondary.opacity(0.15), lineWidth: 1))
                            .shadow(radius: 6)
                            .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
                        }
                    }
                    .frame(width: 450, height: 320)
                    .contentShape(Rectangle())
                    .rotation3DEffect(.degrees(isFlipped ? 180 : 0), axis: (x: 0, y: 1, z: 0))
                    .onTapGesture {
                        withAnimation(.spring()) {
                            isFlipped.toggle()
                        }
                    }
                    
                    // Buttons Action Bar
                    HStack(spacing: 24) {
                        Button(action: {
                            // Again
                            if state.masteredWords[activeWord] == true {
                                state.masteredWords[activeWord] = nil
                            }
                            nextCard()
                        }) {
                            Text("還不熟 (Again)")
                                .font(.headline)
                                .foregroundColor(.red)
                                .frame(width: 160, height: 44)
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(12)
                        }
                        .buttonStyle(.plain)
                        
                        Button(action: {
                            // Mastered
                            state.toggleMastery(for: activeWord)
                            nextCard()
                        }) {
                            Text("已掌握 (Mastered)")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(width: 160, height: 44)
                                .background(Color.green)
                                .cornerRadius(12)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.top, 12)
                }
                .padding()
                .onAppear {
                    loadActiveCardData(activeWord)
                }
            }
        }
    }
    
    private func startSession() {
        var list = state.words
        
        if selectedLevel != "all" {
            list = list.filter { $0.level == Int(selectedLevel) }
        }
        
        if selectedFilter == "unmastered" {
            list = list.filter { state.masteredWords[$0.word] != true }
        } else if selectedFilter == "starred" {
            list = list.filter { state.starredWords[$0.word] == true }
        }
        
        var wordsArray = list.map { $0.word }
        if isRandom {
            wordsArray.shuffle()
        }
        
        if wordsArray.isEmpty {
            let nsAlert = NSAlert()
            nsAlert.messageText = "無符合字卡"
            nsAlert.informativeText = "此過濾條件下無任何單字，請重新調整篩選條件。"
            nsAlert.runModal()
            return
        }
        
        self.flashcardsList = wordsArray
        self.currentIndex = 0
        self.isFlipped = false
    }
    
    private func loadActiveCardData(_ word: String) {
        loading = true
        errorMsg = nil
        dictData = nil
        isFlipped = false
        
        state.fetchDefinition(for: word) { result in
            DispatchQueue.main.async {
                self.loading = false
                switch result {
                case .success(let entry):
                    self.dictData = entry
                case .failure:
                    self.errorMsg = "無法取得英釋義。"
                }
            }
        }
    }
    
    private func nextCard() {
        if currentIndex < flashcardsList.count - 1 {
            currentIndex += 1
            loadActiveCardData(flashcardsList[currentIndex])
        } else {
            let nsAlert = NSAlert()
            nsAlert.messageText = "卡片學習完成！"
            nsAlert.informativeText = "您已完成本次所有的單字卡片複習！"
            nsAlert.runModal()
            flashcardsList = []
        }
    }
}

extension Array {
    var length: Int {
        return self.count
    }
}

// MARK: - Subviews: Quiz

struct QuizQuestion {
    let word: String
    let options: [String]
    let correctOption: String
    let scrambled: [String]
    let definition: String
}

struct QuizView: View {
    @ObservedObject var state: AppState
    
    @State private var quizLevel = "all"
    @State private var quizType = "meaning" // meaning / spelling
    
    @State private var isQuizActive = false
    @State private var isQuizFinished = false
    @State private var loading = false
    
    @State private var questions: [QuizQuestion] = []
    @State private var currentIndex = 0
    @State private var score = 0
    @State private var selectedOption: String? = nil
    
    // Spelling spelling module states
    @State private var spellingInput = ""
    @State private var spellingChecked = false
    
    var body: some View {
        VStack {
            if !isQuizActive && !isQuizFinished {
                // Setup view
                VStack(spacing: 24) {
                    Image(systemName: "questionmark.app.dashed")
                        .font(.system(size: 64))
                        .foregroundColor(.accentColor)
                    
                    Text("智慧單字測驗")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text("每次測驗隨機抽取 10 題核心高頻單字。答對的單字會自動歸入「已掌握」清單中。")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 400)
                    
                    if loading {
                        VStack(spacing: 12) {
                            ProgressView()
                            Text("正從字典庫下載題目，請稍候...")
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 16) {
                            Picker("單字級別：", selection: $quizLevel) {
                                Text("混合所有級別").tag("all")
                                Text("Level 1 (基礎單字)").tag("1")
                                Text("Level 2 (核心高頻)").tag("2")
                                Text("Level 3 (進階挑戰)").tag("3")
                                Text("Level 4 (高分衝刺)").tag("4")
                            }
                            .frame(width: 320)
                            
                            Picker("測驗題型：", selection: $quizType) {
                                Text("英英釋義多選題").tag("meaning")
                                Text("拼寫字元重組題").tag("spelling")
                            }
                            .frame(width: 320)
                        }
                        
                        Button(action: startQuiz) {
                            Text("開始測驗")
                                .font(.headline)
                                .padding(.horizontal, 24)
                                .padding(.vertical, 8)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .padding(40)
            } else if isQuizActive && !isQuizFinished {
                // Active Quiz Card
                let currentQuestion = questions[currentIndex]
                
                VStack(spacing: 24) {
                    // Header progress
                    HStack {
                        Text("問題: \(currentIndex + 1) / 10")
                            .font(.system(.headline, design: .monospaced))
                        Spacer()
                        Text("目前得分: \(score)")
                            .foregroundColor(.accentColor)
                            .fontWeight(.bold)
                    }
                    .padding(.horizontal)
                    
                    ProgressView(value: Double(currentIndex + 1) / 10.0)
                    
                    // Question area
                    if quizType == "meaning" {
                        // English choice quiz
                        VStack(spacing: 16) {
                            Text("請選出最適合此單字釋義的選項:")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            
                            Text(currentQuestion.word)
                                .font(.system(size: 40, weight: .bold, design: .rounded))
                            
                            Button(action: { state.speak(currentQuestion.word) }) {
                                HStack {
                                    Image(systemName: "volume.3.fill")
                                    Text("聽發音")
                                }
                            }
                            .buttonStyle(.link)
                            
                            // Multi-choice list
                            VStack(spacing: 12) {
                                ForEach(currentQuestion.options, id: \.self) { option in
                                    let isAnswered = selectedOption != nil
                                    let isCorrectOption = option == currentQuestion.correctOption
                                    let isUserChoice = option == selectedOption
                                    
                                    Button(action: { handleAnswer(option) }) {
                                        HStack {
                                            Text(option)
                                                .multilineTextAlignment(.leading)
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                            
                                            if isAnswered {
                                                if isCorrectOption {
                                                    Image(systemName: "checkmark.circle.fill")
                                                        .foregroundColor(.green)
                                                } else if isUserChoice {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .foregroundColor(.red)
                                                }
                                            }
                                        }
                                        .padding()
                                        .background(
                                            isAnswered ? 
                                            (isCorrectOption ? Color.green.opacity(0.15) : (isUserChoice ? Color.red.opacity(0.1) : Color.secondary.opacity(0.05))) : 
                                            Color.secondary.opacity(0.05)
                                        )
                                        .cornerRadius(8)
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(isAnswered)
                                }
                            }
                            .padding(.horizontal)
                        }
                    } else {
                        // Word spelling scramble quiz
                        VStack(spacing: 16) {
                            Text("根據英解釋拼寫出正確的單字:")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            
                            Text(currentQuestion.definition)
                                .font(.body)
                                .italic()
                                .multilineTextAlignment(.center)
                                .foregroundColor(.primary)
                                .padding()
                                .background(Color.secondary.opacity(0.05))
                                .cornerRadius(10)
                                .padding(.horizontal)
                            
                            // Scramble tiles
                            HStack(spacing: 8) {
                                ForEach(currentQuestion.scrambled.indices, id: \.self) { i in
                                    Text(currentQuestion.scrambled[i])
                                        .font(.system(.headline, design: .rounded))
                                        .frame(width: 32, height: 32)
                                        .background(Color.accentColor.opacity(0.1))
                                        .foregroundColor(.accentColor)
                                        .cornerRadius(6)
                                }
                            }
                            
                            TextField("輸入您的拼寫...", text: $spellingInput)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 250)
                                .font(.system(.title3, design: .monospaced))
                                .disabled(spellingChecked)
                                .onSubmit {
                                    if !spellingChecked && !spellingInput.trimmingCharacters(in: .whitespaces).isEmpty {
                                        checkSpellingAnswer()
                                    }
                                }
                            
                            if spellingChecked {
                                let isSpellingCorrect = spellingInput.lowercased().trimmingCharacters(in: .whitespaces) == currentQuestion.word
                                VStack(spacing: 8) {
                                    if isSpellingCorrect {
                                        Text("✓ 恭喜答對！")
                                            .foregroundColor(.green)
                                            .fontWeight(.bold)
                                    } else {
                                        Text("✗ 答錯了，正確單字為: \(currentQuestion.word)")
                                            .foregroundColor(.red)
                                            .fontWeight(.bold)
                                    }
                                    Button(action: { state.speak(currentQuestion.word) }) {
                                        HStack {
                                            Image(systemName: "volume.3.fill")
                                            Text("聽正確發音")
                                        }
                                    }
                                    .buttonStyle(.link)
                                }
                            } else {
                                Button("送出答案") {
                                    checkSpellingAnswer()
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(spellingInput.trimmingCharacters(in: .whitespaces).isEmpty)
                            }
                        }
                    }
                    
                    // Footer Navigation to next question
                    if (quizType == "meaning" && selectedOption != nil) || (quizType == "spelling" && spellingChecked) {
                        Button(action: nextQuestion) {
                            HStack {
                                Text(currentIndex == 9 ? "查看測驗結果" : "下一題")
                                Image(systemName: "arrow.right")
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                        }
                        .buttonStyle(.borderedProminent)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.horizontal)
                    }
                }
                .padding()
            } else if isQuizFinished {
                // Quiz Finish Results View
                VStack(spacing: 24) {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 64))
                        .foregroundColor(.yellow)
                    
                    Text("測驗完成！")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text("您的得分為:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Text("\(score) / 100")
                        .font(.system(size: 54, weight: .black, design: .rounded))
                        .foregroundColor(.accentColor)
                    
                    Text(score >= 80 ? "太棒了！您的多益單字量累積得非常迅速！" : (score >= 60 ? "表現不錯，多複習卡片能挑戰更高分喔！" : "再接再厲！持續累積詞彙量是高分的關鍵。"))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 350)
                    
                    HStack(spacing: 16) {
                        Button("返回測驗首頁") {
                            isQuizActive = false
                            isQuizFinished = false
                        }
                        .buttonStyle(.bordered)
                        
                        Button("再測一次") {
                            startQuiz()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .padding(40)
            }
        }
    }
    
    private func startQuiz() {
        loading = true
        isQuizActive = false
        isQuizFinished = false
        questions = []
        currentIndex = 0
        score = 0
        selectedOption = nil
        spellingInput = ""
        spellingChecked = false
        
        // Randomly pick 10 words based on level
        var candidates = state.words
        if quizLevel != "all" {
            candidates = candidates.filter { $0.level == Int(quizLevel) }
        }
        
        guard candidates.count >= 10 else {
            loading = false
            let nsAlert = NSAlert()
            nsAlert.messageText = "資料庫單字數不足"
            nsAlert.informativeText = "符合該層級的單字數不足以進行測驗。"
            nsAlert.runModal()
            return
        }
        
        let shuffled = candidates.shuffled()
        let selectedWords = Array(shuffled.prefix(10)).map { $0.word }
        
        // Parallel load dictionary data to create questions
        let group = DispatchGroup()
        var questionsTemp = [QuizQuestion?](repeating: nil, count: 10)
        
        for (i, word) in selectedWords.enumerated() {
            group.enter()
            state.fetchDefinition(for: word) { result in
                defer { group.leave() }
                
                var definition = "Vocabulary evaluation"
                if case .success(let data) = result {
                    definition = data.meanings?.first?.definitions?.first?.definition ?? "TOEIC core vocabulary"
                }
                
                if self.quizType == "spelling" {
                    // Spelling layout
                    let scrambled = word.map { String($0) }.shuffled()
                    questionsTemp[i] = QuizQuestion(word: word, options: [], correctOption: "", scrambled: scrambled, definition: definition)
                } else {
                    // Multi choice definition layout
                    // Pick 3 distractors
                    var distractors: [String] = []
                    let lock = NSLock()
                    
                    let distractorGroup = DispatchGroup()
                    while distractors.count < 3 {
                        let randWord = state.words.randomElement()?.word ?? "establish"
                        if randWord != word {
                            distractorGroup.enter()
                            state.fetchDefinition(for: randWord) { dResult in
                                defer { distractorGroup.leave() }
                                if case .success(let dData) = dResult,
                                   let dDef = dData.meanings?.first?.definitions?.first?.definition,
                                   dDef != definition {
                                    lock.lock()
                                    if !distractors.contains(dDef) {
                                        distractors.append(dDef)
                                    }
                                    lock.unlock()
                                }
                            }
                        }
                    }
                    
                    _ = distractorGroup.wait(timeout: .now() + 2.0)
                    
                    // Fallbacks for distractors if failed
                    while distractors.count < 3 {
                        let fallbackOption = "Definition fallback for distractor \(distractors.count + 1)"
                        distractors.append(fallbackOption)
                    }
                    
                    let options = (distractors + [definition]).shuffled()
                    questionsTemp[i] = QuizQuestion(word: word, options: options, correctOption: definition, scrambled: [], definition: definition)
                }
            }
        }
        
        group.notify(queue: .main) {
            self.loading = false
            self.questions = questionsTemp.compactMap { $0 }
            if self.questions.count == 10 {
                self.isQuizActive = true
            } else {
                let nsAlert = NSAlert()
                nsAlert.messageText = "測驗初始化失敗"
                nsAlert.informativeText = "無法從 API 下載足夠的單字釋義，請確認您的網路連線。"
                nsAlert.runModal()
            }
        }
    }
    
    private func handleAnswer(_ option: String) {
        selectedOption = option
        if option == questions[currentIndex].correctOption {
            score += 10
            state.toggleMastery(for: questions[currentIndex].word)
        }
    }
    
    private func checkSpellingAnswer() {
        spellingChecked = true
        let wordClean = questions[currentIndex].word
        let userClean = spellingInput.lowercased().trimmingCharacters(in: .whitespaces)
        
        if userClean == wordClean {
            score += 10
            state.toggleMastery(for: wordClean)
        }
    }
    
    private func nextQuestion() {
        if currentIndex < 9 {
            currentIndex += 1
            selectedOption = nil
            spellingInput = ""
            spellingChecked = false
        } else {
            isQuizFinished = true
            state.recordStudyActivity()
        }
    }
}

// MARK: - Subviews: Settings

struct SettingsView: View {
    @ObservedObject var state: AppState
    
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("學習設定")
                .font(.system(.title2, design: .rounded))
                .fontWeight(.bold)
            
            // TTS Settings Group
            VStack(alignment: .leading, spacing: 16) {
                Text("語音與發音設定")
                    .font(.headline)
                    
                HStack(spacing: 24) {
                    Picker("發音腔調 (Accent)：", selection: $state.voiceAccent) {
                        Text("美式英語 (en-US)").tag("en-US")
                        Text("英式英語 (en-GB)").tag("en-GB")
                        Text("加拿大英語 (en-CA)").tag("en-CA")
                        Text("澳洲英語 (en-AU)").tag("en-AU")
                    }
                    .frame(width: 320)
                }
                
                VStack(alignment: .leading, spacing: 6) {
                    Text("朗讀語速 (Speech Rate)： \(state.voiceSpeed, specifier: "%.1f")x")
                        .font(.subheadline)
                    Slider(value: $state.voiceSpeed, in: 0.5...1.5, step: 0.1)
                        .frame(maxWidth: 320)
                }
            }
            .padding()
            .background(Color.secondary.opacity(0.04))
            .cornerRadius(12)
            
            // Goal Settings Group
            VStack(alignment: .leading, spacing: 16) {
                Text("學習目標設定")
                    .font(.headline)
                
                Picker("每日目標熟記數：", selection: $state.dailyGoal) {
                    Text("10 個單字 / 天").tag(10)
                    Text("20 個單字 / 天").tag(20)
                    Text("30 個單字 / 天").tag(30)
                    Text("50 個單字 / 天").tag(50)
                    Text("100 個單字 / 天").tag(100)
                }
                .frame(width: 320)
            }
            .padding()
            .background(Color.secondary.opacity(0.04))
            .cornerRadius(12)
            
            // Dangerous area
            VStack(alignment: .leading, spacing: 16) {
                Text("安全區重置")
                    .font(.headline)
                    .foregroundColor(.red)
                
                Text("重置進度將會清除您所有的已掌握單字標記、收藏星號單字以及學習天數，此動作無法還原。")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: 450, alignment: .leading)
                
                Button(action: handleReset) {
                    HStack {
                        Image(systemName: "trash.fill")
                        Text("清除並重設所有學習進度")
                    }
                    .foregroundColor(.red)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.bordered)
                .accentColor(.red)
            }
            .padding()
            .background(Color.red.opacity(0.02))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.red.opacity(0.1), lineWidth: 1))
            .cornerRadius(12)
            
            Spacer()
        }
        .padding(24)
    }
    
    private func handleReset() {
        let nsAlert = NSAlert()
        nsAlert.messageText = "確定重設進度？"
        nsAlert.informativeText = "您將會失去目前所有的背誦進度與已掌握單字，此動作無法復原！"
        nsAlert.alertStyle = .critical
        nsAlert.addButton(withTitle: "確定清除")
        nsAlert.addButton(withTitle: "取消")
        
        let response = nsAlert.runModal()
        if response == .alertFirstButtonReturn {
            state.resetProgress()
            let finishAlert = NSAlert()
            finishAlert.messageText = "重設成功"
            finishAlert.informativeText = "學習進度已順利歸零！"
            finishAlert.runModal()
        }
    }
}

// MARK: - Main Application Scene

struct SidebarView: View {
    @StateObject private var state = AppState()
    @State private var selectedTab: String? = "dashboard"
    
    var body: some View {
        NavigationSplitView {
            List(selection: $selectedTab) {
                NavigationLink(value: "dashboard") {
                    Label("學習儀表板", systemImage: "trophy")
                }
                NavigationLink(value: "search") {
                    Label("核心字庫搜尋", systemImage: "magnifyingglass")
                }
                NavigationLink(value: "flashcard") {
                    Label("3D 記憶卡片", systemImage: "square.text.square")
                }
                NavigationLink(value: "quiz") {
                    Label("智慧單字測驗", systemImage: "pencil.and.outline")
                }
                NavigationLink(value: "settings") {
                    Label("設定與重設", systemImage: "gearshape")
                }
            }
            .listStyle(.sidebar)
            .navigationTitle("TOEIC-9000")
            
            // Sidebar Footer containing streak status and Git version badge
            VStack(alignment: .leading, spacing: 8) {
                Divider()
                HStack {
                    Image(systemName: "flame.fill")
                        .foregroundColor(.red)
                    Text("學習天數: \(state.streak) 天")
                        .font(.caption)
                        .fontWeight(.bold)
                }
                .padding(.horizontal, 12)
                
                HStack {
                    Image(systemName: "git.branch")
                        .foregroundColor(.secondary)
                    Text("版本: v1.0.0")
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            }
        } detail: {
            switch selectedTab {
            case "dashboard":
                DashboardView(state: state)
            case "search":
                DictionaryView(state: state)
            case "flashcard":
                FlashcardView(state: state)
            case "quiz":
                QuizView(state: state)
            case "settings":
                SettingsView(state: state)
            default:
                Text("選擇側邊欄分頁開始學習")
                    .foregroundColor(.secondary)
            }
        }
        .sheet(item: Binding<String?>(
            get: { state.activeDetailWord },
            set: { state.activeDetailWord = $0 }
        )) { word in
            WordDetailView(word: word, state: state)
        }
        .frame(minWidth: 800, minHeight: 600)
    }
}

extension String: @retroactive Identifiable {
    public var id: String { self }
}

@main
struct TOEICApp: App {
    init() {
        #if os(macOS)
        NSApplication.shared.setActivationPolicy(.regular)
        #endif
    }
    
    var body: some Scene {
        WindowGroup {
            SidebarView()
                .navigationTitle("TOEIC-9000 多益單字大全 v1.0.0")
        }
    }
}

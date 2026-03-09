import Foundation

enum GSDShared {
    static let appGroupID = "group.com.getswitchdone.boards"
    static let supabaseURL = "https://iwkwbvkmpetfcgdjqbgh.supabase.co"
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a3didmttcGV0ZmNnZGpxYmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTM2MTQsImV4cCI6MjA4ODM4OTYxNH0.tCMwpfFh1tLlBI0QneIU2brKimpZXxZJeszF5roi0Pk"

    // UserDefaults keys stored in the App Group
    static let accessTokenKey = "supabase_access_token"
    static let refreshTokenKey = "supabase_refresh_token"
    static let userIdKey = "supabase_user_id"

    // Deep link URL scheme
    static let urlScheme = "gsdboards"
}

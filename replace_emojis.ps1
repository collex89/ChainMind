$directory = "c:\Users\pc\Desktop\firstTask\web3ai"
$html_files = Get-ChildItem -Path $directory -Filter *.html

$replacements = @{
    "🏠" = '<img src="assets/icon_home_1771849990107.png" alt="Home" class="emoji-icon">'
    "🔍" = '<img src="assets/icon_research_1771850004375.png" alt="Research" class="emoji-icon">'
    "📖" = '<img src="assets/icon_learn_1771850086017.png" alt="Learn" class="emoji-icon">'
    "🤖" = '<img src="assets/icon_robot_1771850102245.png" alt="Train AI" class="emoji-icon">'
    "💼" = '<img src="assets/icon_jobs_1771850142744.png" alt="Jobs" class="emoji-icon">'
    "🐦" = '<img src="assets/icon_thread_1771850173040.png" alt="Thread Writer" class="emoji-icon">'
    "📬" = '<img src="assets/icon_feedback_1771850546386.png" alt="Feedback" class="emoji-icon">'
    "⚡" = '<img src="assets/icon_defi_1771850023345.png" alt="DeFi" class="emoji-icon">'
    "🔗" = '<img src="assets/icon_layer2_1771850044279.png" alt="Layer 2" class="emoji-icon">'
    "🏛️" = '<img src="assets/icon_dao_1771850564025.png" alt="DAO" class="emoji-icon">'
    "❤️" = '<img src="assets/icon_heart_1771850577185.png" alt="Heart" class="emoji-icon">'
}

$css = @"
    .emoji-icon {
      width: 1.25em;
      height: 1.25em;
      vertical-align: -0.25em;
      display: inline-block;
      object-fit: contain;
    }
"@

foreach ($file in $html_files) {
    if ($file.Name -eq "index.html") {
        continue
    }
    
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    if (-not $content.Contains(".emoji-icon {")) {
        $content = $content.Replace("</style>", "$css`n  </style>")
    }
    
    foreach ($key in $replacements.Keys) {
        $content = $content.Replace($key, $replacements[$key])
    }
    
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
}
Write-Output "Replaced emojis in all other HTML files."

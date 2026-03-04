import os
import glob

directory = r"c:\Users\pc\Desktop\firstTask\web3ai"
html_files = glob.glob(os.path.join(directory, "*.html"))

replacements = {
    "🏠": '<img src="assets/icon_home_1771849990107.png" alt="Home" class="emoji-icon">',
    "🔍": '<img src="assets/icon_research_1771850004375.png" alt="Research" class="emoji-icon">',
    "📖": '<img src="assets/icon_learn_1771850086017.png" alt="Learn" class="emoji-icon">',
    "🤖": '<img src="assets/icon_robot_1771850102245.png" alt="Train AI" class="emoji-icon">',
    "💼": '<img src="assets/icon_jobs_1771850142744.png" alt="Jobs" class="emoji-icon">',
    "🐦": '<img src="assets/icon_thread_1771850173040.png" alt="Thread Writer" class="emoji-icon">',
    "📬": '<img src="assets/icon_feedback_1771850546386.png" alt="Feedback" class="emoji-icon">',
    "⚡": '<img src="assets/icon_defi_1771850023345.png" alt="DeFi" class="emoji-icon">',
    "🔗": '<img src="assets/icon_layer2_1771850044279.png" alt="Layer 2" class="emoji-icon">',
    "🏛️": '<img src="assets/icon_dao_1771850564025.png" alt="DAO" class="emoji-icon">',
    "❤️": '<img src="assets/icon_heart_1771850577185.png" alt="Heart" class="emoji-icon">'
}

css = """
    .emoji-icon {
      width: 1.25em;
      height: 1.25em;
      vertical-align: -0.25em;
      display: inline-block;
      object-fit: contain;
    }
"""

for file in html_files:
    if "index.html" in file:
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # insert CSS if not there
    if ".emoji-icon {" not in content:
        content = content.replace("</style>", f"{css}  </style>")

    # replace emojis
    for emoji, img_tag in replacements.items():
        content = content.replace(emoji, img_tag)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Replaced emojis in all other HTML files.")

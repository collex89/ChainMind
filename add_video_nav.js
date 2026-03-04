const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/pc/Desktop/firstTask/web3ai';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'video.html');

const videoNavLink = '<li><a href="video.html"><img src="assets/icon_video.png" alt="Video" class="emoji-icon"> Video</a></li>';
const videoMobileLink = '<a href="video.html"><img src="assets/icon_video.png" alt="Video" class="emoji-icon"> Video</a>';

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Skip if already has video link
    if (content.includes('video.html')) continue;

    // Add video link before feedback in navbar-links
    content = content.replace(
        /(<li><a href="feedback\.html">)/,
        `${videoNavLink}\n                $1`
    );

    // Add video link before feedback in mobile menu  
    content = content.replace(
        /(<a href="feedback\.html">(?:(?!<\/a>)[\s\S])*?Feedback<\/a>)/,
        `${videoMobileLink}\n            $1`
    );

    fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Added Video Studio nav links to all pages.');

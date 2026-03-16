// 注入 UI 样式
const style = document.createElement('style');
style.innerHTML = `
    .custom-speed-indicator {
        position: absolute;
        top: 8%; /* 稍微向上移动一点，减少视觉干扰 */
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.5); /* 降低背景明度 */
        backdrop-filter: blur(4px);
        color: rgba(255, 255, 255, 0.7); /* 降低文字明度，不那么刺眼 */
        padding: 4px 12px; /* 缩小容器内边距 */
        border-radius: 4px;
        font-size: 13px; /* 缩小字体 */
        font-weight: normal;
        z-index: 1000;
        pointer-events: none;
        display: none;
        border: 1px solid rgba(255, 255, 255, 0.05); /* 极细微的边框增加质感 */
    }
`;
document.head.appendChild(style);

let speedIndicator = null;

function toggleSpeedUI(show) {
    // 动态绑定 B 站播放器核心区域（适配各种播放模式）
    if (!speedIndicator || !document.body.contains(speedIndicator)) {
        const container = document.querySelector('.bpx-player-video-area') || 
                          document.querySelector('.bilibili-player-video-wrap');
        
        if (!container) return;

        speedIndicator = document.createElement('div');
        speedIndicator.className = 'custom-speed-indicator';
        speedIndicator.innerText = '倍速播放'; // 仅输出文字
        container.appendChild(speedIndicator);
    }

    speedIndicator.style.display = show ? 'block' : 'none';
}


// 1. 初始化默认配置
let config = {
    jumpTime: 3,
    pauseOnRewind: false,
    restorePause: false // 确保初始值存在
};

// 状态变量
let pressTimer = null;
let isLongPressing = false;
let originalPlaybackRate = 1.0;
let wasPausedBeforeLongPress = false;

// 2. 修正后的配置同步逻辑（添加了 restorePause）
chrome.storage.sync.get({ 
    jumpTime: 3, 
    pauseOnRewind: false, 
    restorePause: false 
}, (items) => {
    config.jumpTime = items.jumpTime;
    config.pauseOnRewind = items.pauseOnRewind;
    config.restorePause = items.restorePause;
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.jumpTime) config.jumpTime = changes.jumpTime.newValue;
    if (changes.pauseOnRewind) config.pauseOnRewind = changes.pauseOnRewind.newValue;
    if (changes.restorePause) config.restorePause = changes.restorePause.newValue;
});

// 3. 键盘【按下】监听
window.addEventListener('keydown', (e) => {
    const activeElem = document.activeElement;
    if (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.isContentEditable) return;

    if (e.keyCode === 37 || e.keyCode === 39) {
        const video = document.querySelector('video');
        if (!video) return;

        e.stopImmediatePropagation();
        e.preventDefault();

        // 【左方向键：快退】
        if (e.keyCode === 37) {
            if (e.repeat) return; 
            video.currentTime = Math.max(0, video.currentTime - config.jumpTime);
            if (config.pauseOnRewind) {
                video.pause();
            } else {
                video.play();
            }
        } 
        // 【右方向键：判定】
        else if (e.keyCode === 39) {
            if (e.repeat) return; 

            // 在计时器开始前瞬间记录状态，最准确
            wasPausedBeforeLongPress = video.paused;

            pressTimer = setTimeout(() => {
                isLongPressing = true;
                originalPlaybackRate = video.playbackRate; 
                video.play(); 
                video.playbackRate = 3.0; 
                toggleSpeedUI(true);
            }, 200);
        }
    }
}, true);

// 4. 键盘【抬起】监听
window.addEventListener('keyup', (e) => {
    const activeElem = document.activeElement;
    if (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.isContentEditable) return;

    if (e.keyCode === 39) {
        const video = document.querySelector('video');
        if (!video) return;

        e.stopImmediatePropagation();
        e.preventDefault();

        clearTimeout(pressTimer);

        if (isLongPressing) {
            video.playbackRate = originalPlaybackRate;
            isLongPressing = false;
            toggleSpeedUI(false);
            if (config.restorePause && wasPausedBeforeLongPress) {
                 video.pause();
            }
        } else {
            video.currentTime = Math.min(video.duration, video.currentTime + config.jumpTime);
            video.play(); 
        }
    }
}, true);

/* Bilibili 1.75x Speed Injector */
(() => {
    const inject175Speed = () => {
        const speedList = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
        if (speedList && !speedList.querySelector('.speed-item-175')) {
            const items = speedList.querySelectorAll('li');
            if (items.length === 0) return;

            const templateNode = items[0]; 
            const newSpeedNode = templateNode.cloneNode(true);
            
            newSpeedNode.innerText = '1.75x';
            newSpeedNode.dataset.value = '1.75';
            newSpeedNode.classList.add('speed-item-175');
            newSpeedNode.classList.remove('bpx-state-active');

            newSpeedNode.onclick = (e) => {
                const video = document.querySelector('video');
                if (video) {
                    video.playbackRate = 1.75;
                    speedList.querySelectorAll('li').forEach(li => li.classList.remove('bpx-state-active'));
                    newSpeedNode.classList.add('bpx-state-active');
                    e.stopPropagation();
                }
            };
            templateNode.parentNode.insertBefore(newSpeedNode, templateNode.nextSibling);
        }
    };

    const bpxObserver = new MutationObserver(() => inject175Speed());
    bpxObserver.observe(document.body, { childList: true, subtree: true });
})();

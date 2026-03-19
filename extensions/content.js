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

/* Bilibili Custom Speed Injector (Fixed Order) */
(() => {
    // 你可以在这里随意添加倍速，脚本会自动按倒序排列
    const mySpeeds = [1.75, 1.39];

    const injectSpeeds = () => {
        const speedList = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
        if (!speedList) return;

        // 获取当前已有的所有倍速节点，转为数组方便处理
        let items = Array.from(speedList.querySelectorAll('li'));
        if (items.length === 0) return;

        mySpeeds.forEach(speedValue => {
            const className = `speed-item-${speedValue.toString().replace('.', '')}`;
            
            // 避免重复插入
            if (speedList.querySelector(`.${className}`)) return;

            // 1. 克隆模板（用第一个节点 2.0x 保证样式一致）
            const newNode = items[0].cloneNode(true);
            newNode.innerText = speedValue + 'x';
            newNode.dataset.value = speedValue.toString();
            newNode.className = `bpx-player-ctrl-playbackrate-menu-item ${className}`;
            newNode.classList.remove('bpx-state-active');

            // 2. 核心逻辑：寻找插入位置
            // 遍历现有节点，找到第一个“数值比新倍速小”的节点，插在它前面
            const referenceNode = items.find(li => {
                const val = parseFloat(li.dataset.value || li.innerText);
                return val < speedValue;
            });

            if (referenceNode) {
                speedList.insertBefore(newNode, referenceNode);
            } else {
                speedList.appendChild(newNode); // 如果没找到比它小的，就放最后
            }

            // 3. 重新获取 items 数组，确保下一个自定义倍速能参考到刚插入的节点
            items = Array.from(speedList.querySelectorAll('li'));

            // 4. 绑定点击事件
            newNode.onclick = (e) => {
                const video = document.querySelector('video');
                if (video) {
                    video.playbackRate = speedValue;
                    speedList.querySelectorAll('li').forEach(li => li.classList.remove('bpx-state-active'));
                    newNode.classList.add('bpx-state-active');
                    e.stopPropagation();
                }
            };
        });
    };

    const bpxObserver = new MutationObserver(() => injectSpeeds());
    bpxObserver.observe(document.body, { childList: true, subtree: true });
})();

///临时标记///
(function() {
    // 1. 精细化配置参数
    const CONFIG = {
        shortcutKey: 'z', // 按下 'z' 键创建标记
        // 使用更纯净、具有发光感的主题蓝
        markerColor: '#079F90', 
        // 定义更小的尺寸：宽度 10px，高度约 6.5px (依据你的图片比例)
        markerWidth: '10px',
        markerHeight: '6.5px' 
    };

    // 2. 核心逻辑：获取视频信息并放置标记
    function createMarker() {
        const video = document.querySelector('video');
        const progressContainer = document.querySelector('.bpx-player-progress-area') || 
                                  document.querySelector('.squirtle-progress-area');

        if (!video || !progressContainer) {
            console.warn('未找到视频播放器或进度条容器');
            return;
        }

        // 计算当前进度百分比
        const percentage = (video.currentTime / video.duration) * 100;

        // --- UI 精细化实现：使用 SVG 替代 CSS Border 绘图 ---
        // 这样可以绘制出更像你图片的、带有特定折角的精致图形，而非直边三角形

        const markerContainer = document.createElement('div');
        markerContainer.className = 'custom-video-marker-v2';
        
        // 容器样式：用于定位和应用投影
        Object.assign(markerContainer.style, {
            position: 'absolute',
            left: `${percentage}%`,
            top: '-4px', // 向上偏移，使其悬浮在进度条上方，更具空气感
            width: CONFIG.markerWidth,
            height: CONFIG.markerHeight,
            transform: 'translateX(-50%)', // 自身居中对齐
            zIndex: '1000',
            pointerEvents: 'none',
            // --- 审美的灵魂：添加微弱的发光投影，模拟你图片中的质感 ---
            filter: `drop-shadow(0 0 2px ${CONFIG.markerColor}80)` // 80 是 50% 不透明度
        });

        // 内部填充 SVG，以 10x6.5 为基准绘制图形
        markerContainer.innerHTML = `
            <svg width="100%" height="100%" viewBox="0 0 10 6.5" preserveAspectRatio="none" style="display:block;">
                <path d="M0.5,0 L9.5,0 L9.5,1 L5,6 L0.5,1 Z" fill="${CONFIG.markerColor}"/>
            </svg>
        `;

        // 插入到进度条容器中
        progressContainer.appendChild(markerContainer);
        
        console.log(`标记已创建：${Math.round(video.currentTime)}s`);
    }

    // 3. 监听键盘事件
    window.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement.tagName.toLowerCase();
        if (activeEl === 'input' || activeEl === 'textarea') return;

        if (e.key.toLowerCase() === CONFIG.shortcutKey) {
            createMarker();
        }
    });

    console.log('Bilibili 标记插件(精细版)已激活。');
})();

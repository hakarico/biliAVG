document.addEventListener('DOMContentLoaded', () => {
    const timeInput = document.getElementById('jumpTime');
    const pauseCheckbox = document.getElementById('pauseOnRewind');
    const restorePauseCheckbox = document.getElementById('restorePause');
    const saveBtn = document.getElementById('saveBtn');

    // 读取已保存的设置（默认全部关闭，跳跃3秒）
    chrome.storage.sync.get({ 
        jumpTime: 3, 
        pauseOnRewind: false,
        restorePause: false 
    }, (items) => {
        timeInput.value = items.jumpTime;
        pauseCheckbox.checked = items.pauseOnRewind;
        restorePauseCheckbox.checked = items.restorePause;
    });

    // 保存设置
    saveBtn.addEventListener('click', () => {
        const jumpTime = parseFloat(timeInput.value) || 3;
        const pauseOnRewind = pauseCheckbox.checked;
        const restorePause = restorePauseCheckbox.checked;

        chrome.storage.sync.set({ jumpTime, pauseOnRewind, restorePause }, () => {
            saveBtn.textContent = '保存成功！';
            setTimeout(() => { saveBtn.textContent = '保存设置'; }, 1000);
        });
    });
});

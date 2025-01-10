function getHotkeyPrefix(counter) {
    if (counter <= 9) {
        return '^' + counter;
    } else if (counter <= 18) {
        return '+' + (counter - 9);
    } else if (counter <= 27) {
        return '#' + (counter - 18);
    } else if (counter <= 36) {
        return '!' + (counter - 27);
    } else {
        return '^+' + (counter - 36);
    }
}

function sanitizeText(text) {
    return text
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function showAlert(message) {
    const alertElement = document.getElementById(message === 'generate' ? 'generateAlert' : 'downloadAlert');
    alertElement.style.display = 'block';
    alertElement.style.animation = 'alertSlideIn 0.3s ease-out forwards';
    
    setTimeout(() => {
        alertElement.style.animation = 'alertSlideOut 0.3s ease-out forwards';
        setTimeout(() => {
            alertElement.style.display = 'none';
        }, 300);
    }, 3000);
}

let scriptCode = '';

function checkInput() {
    const inputText = document.getElementById('inputText');
    const generateBtn = document.getElementById('generateBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    
}

async function generateCode() {
    const scrollPos = window.scrollY;
    const inputText = document.getElementById("inputText").value;

    if (!inputText.trim()) {
        showAlert('generate');
        return;
    }

    scriptCode = await callBackendFunction(inputText);

    if (scriptCode) {
        window.scrollTo(0, scrollPos);
        showToast();
        checkInput();
    }
}

async function callBackendFunction(inputText) {
    try {
        const response = await fetch('/.netlify/functions/generateScript', {
            method: 'POST',
            body: JSON.stringify({ text: inputText }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        return data.scriptCode;

    } catch (error) {
        console.error('Erro:', error);
        return null;
    }
}

function downloadFile() {
    if (!scriptCode) {
        showAlert('download');
        return;
    }
    document.getElementById("renameModal").style.display = "flex";
    document.getElementById("scriptName").focus();
    
    document.getElementById("scriptName").addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            confirmDownload();
        }
    });
}

function closeModal() {
    document.getElementById("renameModal").style.display = "none";
    document.getElementById("scriptName").value = "Script";
}

function confirmDownload() {
    if (!scriptCode) {
        showAlert('download');
        return;
    }
    const fileName = document.getElementById("scriptName").value.trim() || "Script";
    
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const header = ';UTF-8\n';
    const blob = new Blob([bom, header, scriptCode], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName + ".ahk";
    link.click();
    
    closeModal();
    checkInput();
}

window.onclick = function(event) {
    const modal = document.getElementById("renameModal");
    if (event.target === modal) {
        closeModal();
    }
}

document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        closeModal();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    checkInput();
    document.getElementById('inputText').addEventListener('input', checkInput);
});

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function splitTextIntoChunks(text, maxLength) {
    text = sanitizeText(text);
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        if (i === 0 && text.startsWith('-')) {
            if (word.length > maxLength) {
                chunks.push(word.substring(0, maxLength));
                let remaining = word.substring(maxLength);
                while (remaining.length > 0) {
                    chunks.push(remaining.substring(0, maxLength));
                    remaining = remaining.substring(maxLength);
                }
            } else {
                currentChunk = word;
            }
            continue;
        }

        if (word.length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            let remainingWord = word;
            while (remainingWord.length > maxLength) {
                chunks.push(remainingWord.substring(0, maxLength));
                remainingWord = remainingWord.substring(maxLength);
            }
            if (remainingWord) currentChunk = remainingWord;
            continue;
        }

        const potentialChunk = currentChunk 
            ? currentChunk + ' ' + word 
            : word;

        if (potentialChunk.length > maxLength) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = word;
        } else {
            currentChunk = potentialChunk;
        }
    }

    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
}

function splitTextIntoChunks(text, maxLength) {
    text = sanitizeText(text);
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        if (word.length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            let remainingWord = word;
            while (remainingWord.length > maxLength) {
                chunks.push(remainingWord.substring(0, maxLength));
                remainingWord = remainingWord.substring(maxLength);
            }
            if (remainingWord) currentChunk = remainingWord;
            continue;
        }

        const potentialChunk = currentChunk 
            ? currentChunk + ' ' + word 
            : word;

        if (potentialChunk.length > maxLength) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = word;
        } else {
            currentChunk = potentialChunk;
        }

        if (word.match(/[.!?]$/)) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
    }

    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks.map(chunk => {
        if (chunk.length <= maxLength) return chunk;
        return chunk.substring(0, maxLength);
    });
}
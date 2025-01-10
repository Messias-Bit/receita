exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Método não permitido" })
        };
    }

    try {
        const inputText = JSON.parse(event.body).text;
        
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

        let scriptCode = `#Persistent\n`;
scriptCode += `#SingleInstance Force\n`;
scriptCode += `#UseHook\n`;
scriptCode += `SetWorkingDir %A_ScriptDir%\n\n`;
scriptCode += `global isPaused := 0\n`;
scriptCode += `global sleepTime := 6000\n`;
scriptCode += `global textIndex := 1\n`;
scriptCode += `global waitingAnswer := 0\n`;
scriptCode += `global username := ""\n\n`;

scriptCode += `IniRead, username, config.ini, Configuracao, Username, %A_Space%\n`;
scriptCode += `if (ErrorLevel) {\n`;
scriptCode += `    username := ""\n`;
scriptCode += `}\n\n`;

scriptCode += `UpdateStatusMessage(message) {\n`;
scriptCode += `    GuiControl,, StatusText, % message\n`;
scriptCode += `    SetTimer, ClearStatus, -4000\n`;
scriptCode += `}\n\n`;

scriptCode += `if (username = "" or username = "ERROR") {\n`;
scriptCode += `    Gosub, ShowConfigGUI\n`;
scriptCode += `} else {\n`;
scriptCode += `    Gosub, ShowMainGUI\n`;
scriptCode += `}\n\n`;

scriptCode += `return\n\n`;

scriptCode += `ShowMainGUI:\n`;
scriptCode += `Gui, New\n`;
scriptCode += `Gui, +AlwaysOnTop\n`;
scriptCode += `Gui, Color, 1E293B, 243449\n`;
scriptCode += `Gui, Margin, 20, 20\n\n`;
scriptCode += `Gui, Font, s12 bold cE2E8F0\n`;
scriptCode += `Gui, Add, Text, x20 y20 w340 h30 Center, AutoScript RCC - Controle\n\n`;

scriptCode += `Gui, Font, s10 normal cE2E8F0\n`;
scriptCode += `Gui, Add, GroupBox, x20 y60 w340 h180, Controles\n\n`;

scriptCode += `Gui, Add, Text, x40 y90, Velocidade do Script:\n`;
scriptCode += `Gui, Add, Slider, x40 y110 w300 vSpeedSlider gUpdateSpeed Range6-8, 6\n`;
scriptCode += `Gui, Add, Text, x40 y140 w300 vSpeedText, % "Intervalo: 6.0 segundos"\n\n`;

scriptCode += `Gui, Add, Button, x40 y170 w90 h30 gStartScript vStartButton, Iniciar\n`;
scriptCode += `Gui, Add, Button, x145 y170 w90 h30 gPauseScript vPauseButton Disabled, Pausar\n`;
scriptCode += `Gui, Add, Button, x250 y170 w90 h30 gReloadScript, Recarregar\n\n`;

scriptCode += `Gui, Font, s9 bold\n`;
scriptCode += `Gui, Add, Text, x20 y250 w340 h30 vStatusText cFF4444 Center\n\n`;

scriptCode += `Gui, Font, s8\n`;
scriptCode += `Gui, Add, Text, x20 y290 w340 Center c94A3B8, Desenvolvido por cralw16\n\n`;

scriptCode += `Gui, Show, w380 h320, AutoScript RCC\n`;
scriptCode += `return\n\n`;

scriptCode += `ShowConfigGUI:\n`;
scriptCode += `Gui, 2:New\n`;
scriptCode += `Gui, 2:+AlwaysOnTop\n`;
scriptCode += `Gui, 2:Color, 1E293B, 243449\n`;
scriptCode += `Gui, 2:Margin, 20, 20\n\n`;
scriptCode += `Gui, 2:Font, s12 bold cE2E8F0\n`;
scriptCode += `Gui, 2:Add, Text, x20 y20 w300 Center, Configuração Inicial\n\n`;
scriptCode += `Gui, 2:Font, s10 normal cE2E8F0\n`;
scriptCode += `Gui, 2:Add, Text, x20 y60 w300, Digite seu nickname:\n`;
scriptCode += `Gui, 2:Add, Edit, x20 y90 w300 h30 vUserNickname\n\n`;
scriptCode += `Gui, 2:Add, Button, x95 y140 w150 h30 gSaveUsername, Confirmar\n\n`;
scriptCode += `Gui, 2:Show, w340 h190, Configuração\n`;
scriptCode += `return\n\n`;

scriptCode += `SetTimer, CheckConfigFile, 1000\n\n`;

scriptCode += `SaveUsername:\n`;
scriptCode += `Gui, 2:Submit, NoHide\n`;
scriptCode += `if (UserNickname = "") {\n`;
scriptCode += `    MsgBox, Por favor, digite seu nickname.\n`;
scriptCode += `    return\n`;
scriptCode += `}\n`;
scriptCode += `username := UserNickname\n`;
scriptCode += `IniWrite, %username%, config.ini, Configuracao, Username\n`;
scriptCode += `Gui, 2:Destroy\n`;
scriptCode += `Gosub, ShowWarningGUI\n`; 
scriptCode += `return\n\n`;

scriptCode += `ShowWarningGUI:\n`; 
scriptCode += `Gui, 4:New, +AlwaysOnTop\n`;
scriptCode += `Gui, 4:Color, 1E293B, 243449\n`;
scriptCode += `Gui, 4:Margin, 20, 20\n\n`;
scriptCode += `Gui, 4:Font, s12 bold cE2E8F0\n`;
scriptCode += `Gui, 4:Add, Text, x20 y20 w360 Center, Aviso Importante\n\n`;
scriptCode += `Gui, 4:Font, s10 normal cE2E8F0\n`;
scriptCode += `Gui, 4:Add, Text, x20 y60 w360, Foi criado um arquivo config.ini no mesmo local deste script. Por favor, não exclua este arquivo, pois ele guarda suas configurações de nickname.\n\n`;
scriptCode += `Gui, 4:Add, Button, x145 y140 w110 h30 gCloseWarning, Entendi\n\n`;
scriptCode += `Gui, 4:Show, w400 h190, Aviso\n`;
scriptCode += `return\n\n`;

scriptCode += `CloseWarning:\n`;
scriptCode += `Gui, 4:Destroy\n`;
scriptCode += `Gosub, ShowMainGUI\n`; 
scriptCode += `return\n\n`;

scriptCode += `Gui, Show, w380 h320, AutoScript RCC\n`;
scriptCode += `SetTimer, CheckConfigFile, 1000\n`;
scriptCode += `return\n\n`;

scriptCode += `UpdateSpeed:\n`;
scriptCode += `Gui, Submit, NoHide\n`;
scriptCode += `sleepTime := SpeedSlider * 1000\n`;
scriptCode += `GuiControl,, SpeedText, % "Intervalo: " . SpeedSlider . ".0 segundos"\n`;
scriptCode += `return\n\n`;

scriptCode += `StartScript:\n`;
scriptCode += `GuiControl, Disable, StartButton\n`;
scriptCode += `GuiControl, Enable, PauseButton\n`;
scriptCode += `isPaused := 0\n`;
scriptCode += `UpdateStatusMessage("Script será iniciado em 5 segundos...")\n`;
scriptCode += `Sleep, 5000\n`;
scriptCode += `UpdateStatusMessage("Script ativo")\n`;
scriptCode += `SetTimer, SendNextText, -100\n`;
scriptCode += `return\n\n`;

scriptCode += `PauseScript:\n`;
scriptCode += `if (isPaused = 0) {\n`;
scriptCode += `    isPaused := 1\n`;
scriptCode += `    SetTimer, SendNextText, Off\n`;
scriptCode += `    GuiControl,, PauseButton, Continuar\n`;
scriptCode += `    UpdateStatusMessage("Script Pausado")\n`;
scriptCode += `} else {\n`;
scriptCode += `    UpdateStatusMessage("Script será reiniciado em 5 segundos...")\n`;
scriptCode += `    Sleep, 5000\n`;
scriptCode += `    isPaused := 0\n`;
scriptCode += `    GuiControl,, PauseButton, Pausar\n`;
scriptCode += `    UpdateStatusMessage("Script Ativo")\n`;
scriptCode += `    SetTimer, SendNextText, -100\n`;
scriptCode += `}\n`;
scriptCode += `return\n\n`;

scriptCode += `ShowQuestion:\n`;
scriptCode += `WinGetPos, mainX, mainY,,, AutoScript RCC\n`;
scriptCode += `confirmX := mainX + 400\n`;
scriptCode += `isPaused := 1\n`;
scriptCode += `SetTimer, SendNextText, Off\n`;
scriptCode += `Gui, 3:Show, x%confirmX% y%mainY% w220 h100, Confirmação\n`;
scriptCode += `UpdateStatusMessage("Script pausado, aguardando resposta do aluno...")\n`;
scriptCode += `return\n\n`;

scriptCode += `AnswerYes:\n`;
scriptCode += `if (!waitingAnswer) {\n`;
scriptCode += `    return\n`;
scriptCode += `}\n`;
scriptCode += `Gui, 3:Hide\n`;
scriptCode += `UpdateStatusMessage("Script será reiniciado em 5 segundos...")\n`;
scriptCode += `Sleep, 5000\n`;
scriptCode += `isPaused := 0\n`;
scriptCode += `textIndex := waitingAnswer + 1\n`;
scriptCode += `waitingAnswer := 0\n`;
scriptCode += `UpdateStatusMessage("Script ativo")\n`;
scriptCode += `SetTimer, SendNextText, -100\n`;
scriptCode += `return\n\n`;

scriptCode += `AnswerNo:\n`;
scriptCode += `Gui, 3:Hide\n`;
scriptCode += `UpdateStatusMessage("")\n`;
scriptCode += `return\n\n`;

scriptCode += `ReloadScript:\n`;
scriptCode += `Reload\n`;
scriptCode += `return\n\n`;

scriptCode += `ClearStatus:\n`;
scriptCode += `GuiControl,, StatusText, % ""\n`;
scriptCode += `return\n\n`;

const lines = inputText.split(/\n|\\n/);
let processedLines = [];

lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine) {
        const isAllCaps = /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s]+$/.test(trimmedLine);
        const isQuestion = trimmedLine.includes('?');
        const isBulletPoint = trimmedLine.startsWith('-');
        const hasColon = trimmedLine.includes(':');

        if (isAllCaps || isQuestion || isBulletPoint || processedLines.length === 0) {
            processedLines.push(trimmedLine);
        } else if (hasColon && processedLines.length > 0) {
            const lastLine = processedLines[processedLines.length - 1];
            if (lastLine.includes(':')) {
                processedLines.push(trimmedLine);
            } else {
                if (!lastLine.includes('?') && !lastLine.startsWith('-') && 
                    !/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s]+$/.test(lastLine)) {
                    processedLines[processedLines.length - 1] += ' ' + trimmedLine;
                } else {
                    processedLines.push(trimmedLine);
                }
            }
        } else {
            const lastLine = processedLines[processedLines.length - 1];
            if (!lastLine.includes('?') && !lastLine.startsWith('-') && 
                !/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s]+$/.test(lastLine)) {
                processedLines[processedLines.length - 1] += ' ' + trimmedLine;
            } else {
                processedLines.push(trimmedLine);
            }
        }
    }
});

let currentIndex = 1;  

scriptCode += `SendNextText:\n`;
scriptCode += `if (isPaused = 1) {\n`;
scriptCode += `    SetTimer, SendNextText, Off\n`;
scriptCode += `    return\n`;
scriptCode += `}\n\n`;

processedLines.forEach(line => {
    const chunks = splitTextIntoChunks(line, 85);
    chunks.forEach(chunk => {
        if (chunk.trim()) {
            scriptCode += `if (textIndex = ${currentIndex}) {\n`;
            scriptCode += `    if (isPaused = 1) {\n`;
            scriptCode += `        SetTimer, SendNextText, Off\n`;
            scriptCode += `        return\n`;
            scriptCode += `    }\n`;

            if (/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s*]+$/.test(chunk)) {
                scriptCode += `    Sleep, 1000\n`;
            }

            scriptCode += `    Send, {Raw}${chunk}\n`;
            scriptCode += `    Send, {Shift Down}{Enter}{Shift Up}\n`;

            if (chunk.includes('?')) {
                scriptCode += `    waitingAnswer := ${currentIndex}\n`;
                scriptCode += `    isPaused := 1\n`;
                scriptCode += `    SetTimer, SendNextText, Off\n`;
                scriptCode += `    Gosub, ShowQuestion\n`;
                scriptCode += `    return\n`;
            } else {
                scriptCode += `    Sleep, %sleepTime%\n`;
                scriptCode += `    textIndex := ${currentIndex + 1}\n`;
                scriptCode += `    SetTimer, SendNextText, -100\n`;
            }
            scriptCode += `}\n\n`;
            currentIndex++;
                    }
                });
            });

scriptCode += `return\n`;

        return {
            statusCode: 200,
            body: JSON.stringify({ scriptCode })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Erro ao processar o texto" })
        };
    }
};

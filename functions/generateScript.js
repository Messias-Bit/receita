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

        function escapeSpecialChars(text) {
            return text
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'")
                .replace(/`/g, '\\`')
                .replace(/\$/g, '\\$')
                .replace(/\{/g, '\\{')
                .replace(/\}/g, '\\}');
        }

        let scriptCode = "#Persistent\n";
scriptCode += "#SingleInstance Force\n";
scriptCode += "#UseHook\n";
scriptCode += "SetWorkingDir %A_ScriptDir%\n\n";

scriptCode += "global SpeedSlider\n";
scriptCode += "global SpeedText\n";
scriptCode += "global StatusText\n";
scriptCode += "global StartButton\n";
scriptCode += "global PauseButton\n";
scriptCode += "global Nickname\n";

scriptCode += "FileCreateDir, %A_ScriptDir%\\AutoScriptConfig\n";
scriptCode += "global configFolder := A_ScriptDir . \"\\AutoScriptConfig\"\n";
scriptCode += "global configFile := configFolder . \"\\nickname_\" . A_ScriptName . \".ini\"\n";

scriptCode += "global isPaused := 0\n";
scriptCode += "global sleepTime := 6000\n";
scriptCode += "global textIndex := 1\n";
scriptCode += "global waitingAnswer := 0\n";
scriptCode += "global totalLines := 0\n";

scriptCode += "UpdateStatusMessage(message) {\n";
scriptCode += "    GuiControl, 1:, StatusText, %message%\n";
scriptCode += "    SetTimer ClearStatus, -4000\n";
scriptCode += "}\n\n";

scriptCode += "ShowMainGui:\n";
scriptCode += "Gui, 1:New\n";
scriptCode += "Gui, 1:+AlwaysOnTop\n";
scriptCode += "Gui, 1:Color, 1E293B, 243449\n";
scriptCode += "Gui, 1:Margin, 20, 20\n\n";

scriptCode += "Gui, 1:Font, s12 bold cE2E8F0\n";
scriptCode += "Gui, 1:Add, Text, x20 y20 w340 h30 Center, AutoScript RCC - Controle\n\n";

scriptCode += "Gui, 1:Font, s10 normal cE2E8F0\n";
scriptCode += "Gui, 1:Add, GroupBox, x20 y60 w340 h180, Controles\n\n";

scriptCode += "Gui, 1:Add, Text, x40 y90, Velocidade do Script:\n";
scriptCode += "Gui, 1:Add, Slider, x40 y110 w300 vSpeedSlider gUpdateSpeed Range6-8, 6\n";
scriptCode += "Gui, 1:Add, Text, x40 y140 w300 vSpeedText, Intervalo: 6.0 segundos\n\n";

scriptCode += "Gui, 1:Add, Button, x40 y170 w90 h30 gStartScript vStartButton, Iniciar\n";
scriptCode += "Gui, 1:Add, Button, x145 y170 w90 h30 gPauseScript vPauseButton Disabled, Pausar\n";
scriptCode += "Gui, 1:Add, Button, x250 y170 w90 h30 gReloadScript, Recarregar\n\n";

scriptCode += "Gui, 1:Font, s9 bold\n";
scriptCode += "Gui, 1:Add, Text, x20 y250 w340 h30 vStatusText cFF4444 Center\n\n";

scriptCode += "Gui, 1:Font, s8\n";
scriptCode += "Gui, 1:Add, Text, x20 y290 w340 Center c94A3B8, Desenvolvido por cralw16\n\n";

scriptCode += "Gui, 1:Show, w380 h320, AutoScript RCC\n";
scriptCode += "return\n\n";

scriptCode += "Gui, 3:+AlwaysOnTop +ToolWindow -SysMenu\n";
scriptCode += "Gui, 3:Color, 1E293B, 243449\n";
scriptCode += "Gui, 3:Margin, 20, 20\n";
scriptCode += "Gui, 3:Font, s10 bold cE2E8F0\n";
scriptCode += "Gui, 3:Add, Text, x20 y20 w200 h30, O aluno respondeu a pergunta?\n";
scriptCode += "Gui, 3:Font, s10 normal\n";
scriptCode += "Gui, 3:Add, Button, x20 y60 w80 h30 gAnswerYes, Sim\n";
scriptCode += "Gui, 3:Add, Button, x110 y60 w80 h30 gAnswerNo, Não\n\n";

scriptCode += "UpdateSpeed:\n";
scriptCode += "Gui, 1:Submit, NoHide\n";
scriptCode += "sleepTime := SpeedSlider * 1000\n";
scriptCode += "GuiControl, 1:, SpeedText, % \"Intervalo: \" . SpeedSlider . \".0 segundos\"\n";
scriptCode += "return\n\n";

scriptCode += "StartScript:\n";
scriptCode += "GuiControl, 1:Disable, StartButton\n";
scriptCode += "GuiControl, 1:Enable, PauseButton\n";
scriptCode += "isPaused := 0\n";
scriptCode += "UpdateStatusMessage(\"Script será iniciado em 5 segundos...\")\n";
scriptCode += "Sleep, 5000\n";
scriptCode += "UpdateStatusMessage(\"Script ativo\")\n";
scriptCode += "SetTimer SendNextText, -100\n";
scriptCode += "return\n\n";

scriptCode += "PauseScript:\n";
scriptCode += "if (isPaused = 0) {\n";
scriptCode += "    isPaused := 1\n";
scriptCode += "    SetTimer SendNextText, Off\n";
scriptCode += "    GuiControl, 1:, PauseButton, Continuar\n";
scriptCode += "    UpdateStatusMessage(\"Script Pausado\")\n";
scriptCode += "} else {\n";
scriptCode += "    UpdateStatusMessage(\"Script será reiniciado em 5 segundos...\")\n";
scriptCode += "    Sleep, 5000\n";
scriptCode += "    isPaused := 0\n";
scriptCode += "    GuiControl, 1:, PauseButton, Pausar\n";
scriptCode += "    UpdateStatusMessage(\"Script Ativo\")\n";
scriptCode += "    SetTimer SendNextText, -100\n";
scriptCode += "}\n";
scriptCode += "return\n\n";

scriptCode += "ShowQuestion:\n";
scriptCode += "WinGetPos, mainX, mainY,,, AutoScript RCC\n";
scriptCode += "confirmX := mainX + 400\n";
scriptCode += "isPaused := 1\n";
scriptCode += "SetTimer SendNextText, Off\n";
scriptCode += "UpdateStatusMessage(\"Script pausado, aguardando resposta do aluno...\")\n";
scriptCode += "if (mainX != \"\" && mainY != \"\") {\n";
scriptCode += "    Gui, 3:Show, x%confirmX% y%mainY% w220 h100, Confirmação\n";
scriptCode += "} else {\n";
scriptCode += "    MsgBox, Falha ao obter a posição da janela principal.\n";
scriptCode += "}\n";
scriptCode += "return\n\n";

scriptCode += "AnswerYes:\n";
scriptCode += "if (!waitingAnswer) {\n";
scriptCode += "    return\n";
scriptCode += "}\n";
scriptCode += "Gui, 3:Hide\n";
scriptCode += "UpdateStatusMessage(\"Script será reiniciado em 5 segundos...\")\n";
scriptCode += "Sleep, 5000\n";
scriptCode += "UpdateStatusMessage(\"Script ativo\")\n";
scriptCode += "isPaused := 0\n";
scriptCode += "textIndex := waitingAnswer + 1\n";
scriptCode += "waitingAnswer := 0\n";
scriptCode += "SetTimer SendNextText, -100\n";
scriptCode += "return\n\n";

scriptCode += "AnswerNo:\n";
scriptCode += "Gui, 3:Hide\n";
scriptCode += "isPaused := 1\n";
scriptCode += "UpdateStatusMessage(\"Resposta negativa - Script pausado\")\n";
scriptCode += "return\n\n";

scriptCode += "ReloadScript:\n";
scriptCode += "Reload\n";
scriptCode += "return\n\n";

scriptCode += "ClearStatus:\n";
scriptCode += "GuiControl, 1:, StatusText\n";
scriptCode += "return\n\n";

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

scriptCode += "totalLines := " + processedLines.length + "\n\n";

scriptCode += "SendNextText:\n";
scriptCode += "if (isPaused = 1) {\n";
scriptCode += "    SetTimer SendNextText, Off\n";
scriptCode += "    return\n";
scriptCode += "}\n\n";

scriptCode += "if (textIndex > totalLines) {\n";
scriptCode += "    UpdateStatusMessage(\"Script concluído\")\n";
scriptCode += "    isPaused := 1\n";
scriptCode += "    GuiControl, 1:Enable, StartButton\n";
scriptCode += "    GuiControl, 1:Disable, PauseButton\n";
scriptCode += "    return\n";
scriptCode += "}\n\n";

processedLines.forEach(line => {
    const chunks = splitTextIntoChunks(line, 85);
    chunks.forEach(chunk => {
        if (chunk.trim()) {
            scriptCode += "if (textIndex = " + currentIndex + ") {\n";
            scriptCode += "    if (isPaused = 1) {\n";
            scriptCode += "        SetTimer SendNextText, Off\n";
            scriptCode += "        return\n";
            scriptCode += "    }\n";

            if (/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s*]+$/.test(chunk)) {
                scriptCode += "    Sleep, 1000\n";
            }

            scriptCode += "    Send, {Raw}" + chunk + "\n";
            scriptCode += "    Send, {Shift Down}{Enter}{Shift Up}\n";

            if (chunk.includes('?')) {
                scriptCode += "    UpdateStatusMessage(\"Script pausado, aguardando resposta do aluno...\")\n";
                scriptCode += "    waitingAnswer := " + currentIndex + "\n";
                scriptCode += "    isPaused := 1\n";
                scriptCode += "    SetTimer SendNextText, Off\n";
                scriptCode += "    Gosub, ShowQuestion\n";
                scriptCode += "    return\n";
            } else {
                scriptCode += "    Sleep, %sleepTime%\n";
                scriptCode += "    textIndex := " + (currentIndex + 1) + "\n";
                scriptCode += "    SetTimer SendNextText, -100\n";
            }
            scriptCode += "}\n\n";
            currentIndex++;
        }
    });
});

function splitTextIntoChunks(text, chunkSize) {
    const regex = new RegExp(`.{1,${chunkSize}}`, 'g');
    return text.match(regex);
}

if (inputText.includes("{username}")) {
    scriptCode = `
        IfNotExist, %configFile%
        {
            Gosub, ShowNicknameConfig
        }
        else 
        {
            Gosub, TransformText
            Gosub, ShowMainGui
        }
    ` + "\n" + scriptCode;

    scriptCode += "ShowNicknameConfig:\n";
    scriptCode += "Gui, 2:New\n";
    scriptCode += "Gui, 2:+AlwaysOnTop -MinimizeBox -SysMenu\n";
    scriptCode += "Gui, 2:Color, 1E293B, 243449\n";
    scriptCode += "Gui, 2:Margin, 20, 20\n";
    scriptCode += "Gui, 2:Font, s10 bold cE2E8F0\n";
    scriptCode += "Gui, 2:Add, Text, x20 y20 w200 h30, Digite seu nickname (máx 25 caracteres):\n";
    scriptCode += "Gui, 2:Font, s10 normal\n";
    scriptCode += "Gui, 2:Add, Edit, x20 y60 w200 vNickname Limit25\n";
    scriptCode += "Gui, 2:Add, Button, x20 y100 w80 h30 gSaveNicknameConfirm, Confirmar\n";
    scriptCode += "Gui, 2:Show, Center, Configuração de Nickname\n";
    scriptCode += "return\n\n";

    scriptCode += "SaveNicknameConfirm:\n";
    scriptCode += "Gui, 2:Submit, NoHide\n";
    scriptCode += "if (Nickname = \"\") {\n";
    scriptCode += "    MsgBox, Por favor, digite um nickname.\n";
    scriptCode += "    return\n";
    scriptCode += "}\n";
    scriptCode += "IniWrite, %Nickname%, %configFile%, User, Nickname\n";
    scriptCode += "Gui, 2:Destroy\n";
    scriptCode += "Gosub, ShowConfigWarning\n";
    scriptCode += "return\n\n";

    scriptCode += "ShowConfigWarning:\n";
    scriptCode += "Gui, 4:New\n";
    scriptCode += "Gui, 4:+AlwaysOnTop\n";
    scriptCode += "Gui, 4:Color, 1E293B, 243449\n";
    scriptCode += "Gui, 4:Margin, 20, 20\n";
    scriptCode += "Gui, 4:Font, s10 bold cE2E8F0\n";
    scriptCode += "Gui, 4:Add, Text, x20 y20 w400 h60, Um arquivo de configuração foi criado na pasta AutoScriptConfig.`nNão o exclua; ele armazena seu nickname.\n";
    scriptCode += "Gui, 4:Add, Button, x160 y90 w80 h30 gCloseWarning, Entendi\n";
    scriptCode += "Gui, 4:Show, w440 h140 Center, Aviso Importante\n";
    scriptCode += "return\n\n";

    scriptCode += "CloseWarning:\n";
    scriptCode += "Gui, 4:Destroy\n";
    scriptCode += "Gosub, ShowMainGui\n";
    scriptCode += "return\n\n";

    scriptCode += "TransformText:\n";
    scriptCode += "IniRead, Nickname, %configFile%, User, Nickname\n";
    scriptCode += "if (Nickname != \"ERROR\") {\n";
    scriptCode += "    StringReplace, inputText, inputText, {username}, %Nickname%, All\n";
    scriptCode += "}\n";
    scriptCode += "return\n\n";
} else {
    scriptCode += "Gosub, ShowMainGui\n";
}

        return {
            statusCode: 200,
            body: JSON.stringify({ scriptCode })
        };

    } catch (error) {
        console.error('Erro no processamento:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Erro ao processar o texto" })
        };
    }
};


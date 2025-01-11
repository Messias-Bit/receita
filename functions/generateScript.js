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

        let scriptCode = `#Persistent\n`;
scriptCode += `#SingleInstance Force\n`;
scriptCode += `#UseHook\n`;
scriptCode += `SetWorkingDir, %A_ScriptDir%\n\n`; // Corrigido: vírgula adicionada

scriptCode += `; Declaração adequada de variáveis globais\n`;
scriptCode += `global configFile := A_ScriptDir . "\\config.ini"\n`;
scriptCode += `global userNickname := ""\n`;
scriptCode += `global isPaused := 0\n`;
scriptCode += `global sleepTime := 6000\n`;
scriptCode += `global textIndex := 1\n`;
scriptCode += `global waitingAnswer := 0\n`;
scriptCode += `global isGuiActive := 0\n\n`; // Nova variável para controle de GUI

scriptCode += `; Inicialização segura\n`;
scriptCode += `SetWorkingDir, %A_ScriptDir%\n`;
scriptCode += `SetBatchLines, -1\n`;
scriptCode += `#MaxThreadsPerHotkey 1\n`;
scriptCode += `SendMode Input\n\n`; // Garante envio mais confiável

scriptCode += `if FileExist(configFile) {\n`;
scriptCode += `    IniRead, userNickname, %configFile%, Settings, Nickname, %A_Space%\n`; // Melhor tratamento de erro
scriptCode += `    if (userNickname = "" || userNickname = %A_Space%) {\n`;
scriptCode += `        Gosub, ShowNicknameGui\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n`;
scriptCode += `    Gosub, CreateMainGui\n`;
scriptCode += `} else {\n`;
scriptCode += `    Gosub, ShowNicknameGui\n`;
scriptCode += `    return\n`;
scriptCode += `}\n\n`;

scriptCode += `UpdateStatusMessage(message) {\n`;
scriptCode += `    if !WinExist("AutoScript RCC") {\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n`;
scriptCode += `    GuiControl, 1:, StatusText, % message\n`;
scriptCode += `    SetTimer, ClearStatus, -4000\n`;
scriptCode += `}\n\n`;

scriptCode += `SaveNickname:\n`;
scriptCode += `Gui, 2:Submit, NoHide\n`;
scriptCode += `GuiControlGet, NewNickname,, NewNickname\n`;
scriptCode += `if (NewNickname = "") {\n`;
scriptCode += `    MsgBox, 16, Erro, Por favor, digite um nickname válido.\n`; // Corrigido
scriptCode += `    return\n`;
scriptCode += `}\n`;
scriptCode += `if (StrLen(NewNickname) > 25) {\n`;
scriptCode += `    MsgBox, 16, Erro, O nickname não pode ter mais de 25 caracteres!\n`;
scriptCode += `    return\n`;
scriptCode += `}\n\n`;

scriptCode += `try {\n`;
scriptCode += `    userNickname := NewNickname\n`;
scriptCode += `    IniWrite, %userNickname%, %configFile%, Settings, Nickname\n`;
scriptCode += `    if ErrorLevel {\n`;
scriptCode += `        throw "Erro ao salvar configuração"\n`;
scriptCode += `    }\n`;
scriptCode += `    isGuiActive := 0\n`;
scriptCode += `    Gui, 2:Destroy\n`;
scriptCode += `    MsgBox, 64, Aviso Importante, Foi criado um arquivo config.ini no mesmo local deste script.\nPor favor, não exclua este arquivo, pois ele guarda suas configurações de nickname.\n`; // Corrigido
scriptCode += `    Gosub, CreateMainGui\n`;
scriptCode += `} catch e {\n`;
scriptCode += `    MsgBox, 16, Erro, Não foi possível salvar o nickname. Verifique as permissões da pasta.\n`;
scriptCode += `    return\n`;
scriptCode += `}\n`;
scriptCode += `return\n\n`;

scriptCode += `CreateMainGui:\n`;
scriptCode += `SetTimer, CheckConfigFile, Off\n`;
scriptCode += `Gui, 1:New\n`;
scriptCode += `Gui, 1:+AlwaysOnTop +OwnDialogs\n`;
scriptCode += `Gui, 1:Color, 1E293B, 243449\n`;
scriptCode += `Gui, 1:Margin, 20, 20\n\n`;

scriptCode += `; Proteção contra múltiplas instâncias da GUI\n`;
scriptCode += `if WinExist("AutoScript RCC") {\n`;
scriptCode += `    WinActivate\n`;
scriptCode += `    return\n`;
scriptCode += `}\n\n`;

scriptCode += `Gui, 1:Font, s12 bold cE2E8F0\n`;
scriptCode += `Gui, 1:Add, Text, x20 y20 w340 h30 Center, AutoScript RCC - Controle\n\n`;

scriptCode += `Gui, 1:Font, s10 normal cE2E8F0\n`;
scriptCode += `Gui, 1:Add, GroupBox, x20 y60 w340 h180, Controles\n\n`;

scriptCode += `Gui, 1:Add, Text, x40 y90, Velocidade do Script:\n`;
scriptCode += `Gui, 1:Add, Slider, x40 y110 w300 vSpeedSlider gUpdateSpeed Range6-8 AltSubmit, 6\n`; // AltSubmit adicionado
scriptCode += `Gui, 1:Add, Text, x40 y140 w300 vSpeedText, Intervalo: 6.0 segundos\n\n`;

scriptCode += `Gui, 1:Add, Button, x40 y170 w90 h30 gStartScript vStartButton, Iniciar\n`;
scriptCode += `Gui, 1:Add, Button, x145 y170 w90 h30 gPauseScript vPauseButton Disabled, Pausar\n`;
scriptCode += `Gui, 1:Add, Button, x250 y170 w90 h30 gReloadScript, Recarregar\n\n`;

scriptCode += `Gui, 1:Font, s9 bold\n`;
scriptCode += `Gui, 1:Add, Text, x20 y250 w340 h30 vStatusText cFF4444 Center\n\n`;

scriptCode += `Gui, 1:Font, s8\n`;
scriptCode += `Gui, 1:Add, Text, x20 y290 w340 Center c94A3B8, Desenvolvido por cralw16\n\n`;

scriptCode += `Gui, 1:Show, w380 h320, AutoScript RCC\n`;
scriptCode += `SetTimer, CheckConfigFile, 5000\n`;
scriptCode += `return\n\n`;

scriptCode += `UpdateSpeed:\n`;
scriptCode += `Critical, On\n`; // Previne interrupções durante a atualização
scriptCode += `Gui, 1:Submit, NoHide\n`;
scriptCode += `sleepTime := SpeedSlider * 1000\n`;
scriptCode += `GuiControl, 1:, SpeedText, % "Intervalo: " . SpeedSlider . ".0 segundos"\n`;
scriptCode += `Critical, Off\n`;
scriptCode += `return\n\n`;

scriptCode += `StartScript:\n`;
scriptCode += `Critical, On\n`;
scriptCode += `GuiControl, 1:Disable, StartButton\n`;
scriptCode += `GuiControl, 1:Enable, PauseButton\n`;
scriptCode += `GuiControl, 1:, PauseButton, Pausar\n`;
scriptCode += `isPaused := 0\n`;
scriptCode += `UpdateStatusMessage("Script será iniciado em 5 segundos...")\n`;
scriptCode += `Critical, Off\n`;
scriptCode += `Sleep, 5000\n`;
scriptCode += `if (!isPaused) {\n`;
scriptCode += `    UpdateStatusMessage("Script ativo")\n`;
scriptCode += `    SetTimer, SendNextText, -100\n`;
scriptCode += `}\n`;
scriptCode += `return\n\n`;

scriptCode += `PauseScript:\n`;
scriptCode += `Critical, On\n`;
scriptCode += `if (isPaused = 0) {\n`;
scriptCode += `    isPaused := 1\n`;
scriptCode += `    SetTimer, SendNextText, Off\n`;
scriptCode += `    GuiControl, 1:, PauseButton, Continuar\n`;
scriptCode += `    UpdateStatusMessage("Script Pausado")\n`;
scriptCode += `} else {\n`;
scriptCode += `    if !FileExist(configFile) {\n`;
scriptCode += `        MsgBox, 16, Erro, Arquivo de configuração não encontrado. O script será recarregado.\n`;
scriptCode += `        Reload\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n`;
scriptCode += `    UpdateStatusMessage("Script será reiniciado em 5 segundos...")\n`;
scriptCode += `    Critical, Off\n`;
scriptCode += `    Sleep, 5000\n`;
scriptCode += `    Critical, On\n`;
scriptCode += `    isPaused := 0\n`;
scriptCode += `    GuiControl, 1:, PauseButton, Pausar\n`;
scriptCode += `    UpdateStatusMessage("Script Ativo")\n`;
scriptCode += `    SetTimer, SendNextText, -100\n`;
scriptCode += `}\n`;
scriptCode += `Critical, Off\n`;
scriptCode += `return\n\n`;

ptCode += `ShowQuestion:\n`;
scriptCode += `Critical, On\n`;
scriptCode += `if (waitingAnswer) {\n`;
scriptCode += `    WinGetPos, mainX, mainY,,, AutoScript RCC\n`;
scriptCode += `    if (ErrorLevel) {\n`;
scriptCode += `        mainX := A_ScreenWidth // 2 - 110\n`;
scriptCode += `        mainY := A_ScreenHeight // 2 - 50\n`;
scriptCode += `    } else {\n`;
scriptCode += `        mainX += 400\n`;
scriptCode += `    }\n`;
scriptCode += `    Gui, 3:New\n`;
scriptCode += `    Gui, 3:+AlwaysOnTop +ToolWindow +OwnDialogs\n`;
scriptCode += `    Gui, 3:Color, 1E293B, 243449\n`;
scriptCode += `    Gui, 3:Margin, 20, 20\n`;
scriptCode += `    Gui, 3:Font, s10 bold cE2E8F0\n`;
scriptCode += `    Gui, 3:Add, Text, x20 y20 w200 h30, O aluno respondeu a pergunta?\n`;
scriptCode += `    Gui, 3:Font, s10 normal\n`;
scriptCode += `    Gui, 3:Add, Button, x20 y60 w80 h30 gAnswerYes Default, Sim\n`;
scriptCode += `    Gui, 3:Add, Button, x110 y60 w80 h30 gAnswerNo, Não\n`;
scriptCode += `    Gui, 3:Show, x%mainX% y%mainY% w220 h100, Confirmação\n`;
scriptCode += `}\n`;
scriptCode += `Critical, Off\n`;
scriptCode += `return\n\n`;

scriptCode += `AnswerYes:\n`;
scriptCode += `Critical, On\n`;
scriptCode += `if (!waitingAnswer) {\n`;
scriptCode += `    Gui, 3:Destroy\n`;
scriptCode += `    Critical, Off\n`;
scriptCode += `    return\n`;
scriptCode += `}\n`;
scriptCode += `Gui, 3:Destroy\n`;
scriptCode += `UpdateStatusMessage("Script será reiniciado em 5 segundos...")\n`;
scriptCode += `Critical, Off\n`;
scriptCode += `Sleep, 5000\n`;
scriptCode += `Critical, On\n`;
scriptCode += `if (FileExist(configFile)) {\n`;
scriptCode += `    UpdateStatusMessage("Script ativo")\n`;
scriptCode += `    isPaused := 0\n`;
scriptCode += `    textIndex := waitingAnswer + 1\n`;
scriptCode += `    waitingAnswer := 0\n`;
scriptCode += `    SetTimer, SendNextText, -100\n`;
scriptCode += `} else {\n`;
scriptCode += `    MsgBox, 16, Erro, Arquivo de configuração não encontrado. O script será recarregado.\n`;
scriptCode += `    Reload\n`;
scriptCode += `}\n`;
scriptCode += `Critical, Off\n`;
scriptCode += `return\n\n`;

scriptCode += `AnswerNo:\n`;
scriptCode += `Critical, On\n`;
scriptCode += `if (!waitingAnswer) {\n`;
scriptCode += `    Gui, 3:Destroy\n`;
scriptCode += `    Critical, Off\n`;
scriptCode += `    return\n`;
scriptCode += `}\n`;
scriptCode += `Gui, 3:Destroy\n`;
scriptCode += `isPaused := 1\n`;
scriptCode += `Critical, Off\n`;
scriptCode += `return\n\n`;

scriptCode += `ReloadScript:\n`;
scriptCode += `Critical, On\n`;
scriptCode += `SetTimer, SendNextText, Off\n`;
scriptCode += `SetTimer, CheckConfigFile, Off\n`;
scriptCode += `Critical, Off\n`;
scriptCode += `Reload\n`;
scriptCode += `return\n\n`;

scriptCode += `ClearStatus:\n`;
scriptCode += `GuiControl, 1:, StatusText,\n`;
scriptCode += `return\n\n`;

scriptCode += `CheckConfigFile:\n`;
scriptCode += `Critical, On\n`;
scriptCode += `if (!FileExist(configFile)) {\n`;
scriptCode += `    SetTimer, SendNextText, Off\n`;
scriptCode += `    SetTimer, CheckConfigFile, Off\n`;
scriptCode += `    MsgBox, 16, Erro, Arquivo de configuração não encontrado.\nO script será recarregado para configuração do nickname.\n`; // Corrigido
scriptCode += `    Gui, 1:Destroy\n`;
scriptCode += `    Gui, 3:Destroy\n`;
scriptCode += `    isGuiActive := 0\n`;
scriptCode += `    Gosub, ShowNicknameGui\n`;
scriptCode += `}\n`;
scriptCode += `Critical, Off\n`;
scriptCode += `return\n\n`;

scriptCode += `SendNextText:\n`;
scriptCode += `Critical, On\n`;
scriptCode += `if (isPaused) {\n`;
scriptCode += `    SetTimer, SendNextText, Off\n`;
scriptCode += `    Critical, Off\n`;
scriptCode += `    return\n`;
scriptCode += `}\n\n`;



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
processedLines.forEach(line => {
    const chunks = splitTextIntoChunks(line, 85);
    chunks.forEach(chunk => {
        if (chunk.trim()) {
            const escapedChunk = chunk
                .replace(/"/g, '""')
                .replace(/`/g, "``")
                .replace(/\\/g, "\\")
                .replace(/\{/g, "{{}")
                .replace(/\}/g, "{}}")
                .replace(/\r/g, "")
                .replace(/\n/g, "")
                .replace(/[%]/g, "`%");

            scriptCode += `if (textIndex = ${currentIndex}) {\n`;
            scriptCode += `    if (isPaused) {\n`;
            scriptCode += `    SetTimer, SendNextText, Off\n`;
            scriptCode += `    Critical, Off\n`;
            scriptCode += `    return\n`;
            scriptCode += `    }\n`;

            if (/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s*]+$/.test(chunk)) {
                scriptCode += `    Sleep, 1000\n`;
            }

            scriptCode += `    SendInput % RegExReplace("${escapedChunk}", "\\{username\\}", userNickname)\n`;
            scriptCode += `    SendInput, {Shift Down}{Enter}{Shift Up}\n`;

            if (chunk.includes('?')) {
                scriptCode += `    waitingAnswer := ${currentIndex}\n`;
                scriptCode += `    Critical, Off\n`;
                scriptCode += `    Gosub, ShowQuestion\n`;
                scriptCode += `    return\n`;
            } else {
                scriptCode += `    Sleep, %sleepTime%\n`;
                scriptCode += `    textIndex := ${currentIndex + 1}\n`;
                scriptCode += `    Critical, Off\n`;
                scriptCode += `    SetTimer, SendNextText, -100\n`;
            }
            scriptCode += `}\n\n`;
            currentIndex++;
        }
    });
});

scriptCode += `Critical, Off\n`;
scriptCode += `return\n`;

scriptCode += `1GuiClose:\n2GuiClose:\n3GuiClose:\n`;
scriptCode += `Critical, On\n`;
scriptCode += `SetTimer, SendNextText, Off\n`;
scriptCode += `SetTimer, CheckConfigFile, Off\n`;
scriptCode += `ExitApp\n`;
        
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

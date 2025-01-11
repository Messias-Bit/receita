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

        let scriptCode = '#Requires AutoHotkey v2.0\n';
scriptCode += '#SingleInstance Force\n\n';

scriptCode += '; Declaração de variáveis globais\n';
scriptCode += 'global configFile := A_ScriptDir "\\config.ini"\n';
scriptCode += 'global userNickname := ""\n';
scriptCode += 'global isPaused := 0\n';
scriptCode += 'global sleepTime := 6000\n';
scriptCode += 'global textIndex := 1\n';
scriptCode += 'global waitingAnswer := 0\n';
scriptCode += 'global isGuiActive := 0\n\n';

scriptCode += '; Inicialização\n';
scriptCode += 'SetWorkingDir A_ScriptDir\n';
scriptCode += 'A_MaxHotkeysPerInterval := 99\n';
scriptCode += 'ProcessSetPriority "High"\n\n';

scriptCode += 'if FileExist(configFile) {\n';
scriptCode += '    try {\n';
scriptCode += '        userNickname := IniRead(configFile, "Settings", "Nickname")\n';
scriptCode += '        if (userNickname = "") {\n';
scriptCode += '            ShowNicknameGui()\n';
scriptCode += '        } else {\n';
scriptCode += '            CreateMainGui()\n';
scriptCode += '        }\n';
scriptCode += '    } catch Error as err {\n';
scriptCode += '        ShowNicknameGui()\n';
scriptCode += '    }\n';
scriptCode += '} else {\n';
scriptCode += '    ShowNicknameGui()\n';
scriptCode += '}\n\n';

scriptCode += 'UpdateStatusMessage(message) {\n';
scriptCode += '    try {\n';
scriptCode += '        mainGui["StatusText"].Text := message\n';
scriptCode += '    } catch Error {\n';
scriptCode += '        ; Ignora erro se a GUI não existir\n';
scriptCode += '    }\n';
scriptCode += '}\n\n';

scriptCode += 'ShowNicknameGui() {\n';
scriptCode += '    global isGuiActive, nicknameGui\n\n';
scriptCode += '    if (isGuiActive)\n';
scriptCode += '        return\n\n';
scriptCode += '    isGuiActive := 1\n';
scriptCode += '    nicknameGui := Gui("+AlwaysOnTop -MinimizeBox")\n';
scriptCode += '    nicknameGui.SetFont("s12 bold", "Segoe UI")\n';
scriptCode += '    nicknameGui.BackColor := "0x1E293B"\n\n';

scriptCode += '    nicknameGui.SetFont("s16 bold")\n';
scriptCode += '    nicknameGui.AddText("x20 y20 w300 Center c0xE2E8F0", "AutoScript RCC")\n\n';

scriptCode += '    nicknameGui.SetFont("s10 normal")\n';
scriptCode += '    nicknameGui.AddText("x20 y60 c0xE2E8F0", "Digite seu nickname (máx. 25 caracteres):")\n\n';

scriptCode += '    nickEdit := nicknameGui.AddEdit("x20 y85 w300 Limit25 c0x000000")\n';
scriptCode += '    nickEdit.Name := "NewNickname"\n';
scriptCode += '    nickEdit.OnEvent("Change", CheckNicknameLength)\n\n';

scriptCode += '    confirmBtn := nicknameGui.AddButton("x110 y125 w120 h30 Default", "Confirmar")\n';
scriptCode += '    confirmBtn.OnEvent("Click", SaveNickname)\n\n';

scriptCode += '    nicknameGui.SetFont("s8")\n';
scriptCode += '    nicknameGui.AddText("x20 y290 w300 Center c0x94A3B8", "Desenvolvido por cralw16")\n\n';

scriptCode += '    nicknameGui.OnEvent("Close", (*) => ExitApp())\n';
scriptCode += '    nicknameGui.Title := "Configuração Inicial"\n';
scriptCode += '    nicknameGui.Show("w340 h170")\n';
scriptCode += '}\n\n';

scriptCode += 'CheckNicknameLength(guiCtrl, *) {\n';
scriptCode += '    if (StrLen(guiCtrl.Value) > 25) {\n';
scriptCode += '        MsgBox("O nickname não pode ter mais de 25 caracteres!", "Aviso", "0x30")\n';
scriptCode += '        guiCtrl.Value := SubStr(guiCtrl.Value, 1, 25)\n';
scriptCode += '    }\n';
scriptCode += '}\n\n';

scriptCode += 'SaveNickname(guiCtrl, *) {\n';
scriptCode += '    global userNickname, configFile, isGuiActive\n\n';
scriptCode += '    newNickname := guiCtrl.Gui["NewNickname"].Value\n\n';
scriptCode += '    if (newNickname = "") {\n';
scriptCode += '        MsgBox("Por favor, digite um nickname válido.", "Erro", "0x10")\n';
scriptCode += '        return\n';
scriptCode += '    }\n\n';

scriptCode += '    try {\n';
scriptCode += '        userNickname := newNickname\n';
scriptCode += '        IniWrite(userNickname, configFile, "Settings", "Nickname")\n';
scriptCode += '        isGuiActive := 0\n';
scriptCode += '        guiCtrl.Gui.Destroy()\n';
scriptCode += '        MsgBox("Foi criado um arquivo config.ini no mesmo local deste script.`nPor favor, não exclua este arquivo, pois ele guarda suas configurações de nickname.", "Aviso Importante", "0x40")\n';
scriptCode += '        CreateMainGui()\n';
scriptCode += '    } catch Error as err {\n';
scriptCode += '        MsgBox("Não foi possível salvar o nickname. Verifique as permissões da pasta.`n`nErro: " err.Message, "Erro", "0x10")\n';
scriptCode += '    }\n';
scriptCode += '}\n\n';

scriptCode += 'CreateMainGui() {\n';
scriptCode += '    global mainGui\n';
scriptCode += '    mainGui := Gui("+AlwaysOnTop -MinimizeBox")\n';
scriptCode += '    mainGui.SetFont("s12 bold", "Segoe UI")\n';
scriptCode += '    mainGui.BackColor := "0x1E293B"\n\n';

scriptCode += '    mainGui.SetFont("s16 bold")\n';
scriptCode += '    mainGui.AddText("x20 y20 w360 Center c0xE2E8F0", "AutoScript RCC")\n\n';

scriptCode += '    mainGui.SetFont("s10")\n';
scriptCode += '    mainGui.AddText("x20 y60 c0xE2E8F0", "Nickname: " userNickname)\n\n';

scriptCode += '    mainGui.AddText("x20 y90 c0xE2E8F0", "Status:")\n';
scriptCode += '    statusText := mainGui.AddText("x80 y90 w300 c0x4ADE80", "Script ativo")\n';
scriptCode += '    statusText.Name := "StatusText"\n\n';

scriptCode += '    mainGui.AddGroupBox("x20 y120 w340 h120", "Controles")\n\n';

scriptCode += '    mainGui.AddText("x40 y140 c0xE2E8F0", "Velocidade do Script:")\n';
scriptCode += '    speedSlider := mainGui.AddSlider("x40 y160 w300 Range6-8", 6)\n';
scriptCode += '    speedSlider.Name := "SpeedSlider"\n';
scriptCode += '    speedSlider.OnEvent("Change", UpdateSpeed)\n\n';

scriptCode += '    speedText := mainGui.AddText("x40 y190 w300 c0xE2E8F0", "Intervalo: 6.0 segundos")\n';
scriptCode += '    speedText.Name := "SpeedText"\n\n';

scriptCode += '    startBtn := mainGui.AddButton("x40 y250 w90 h30", "Iniciar")\n';
scriptCode += '    startBtn.OnEvent("Click", StartScript)\n';
scriptCode += '    startBtn.Name := "StartButton"\n\n';

scriptCode += '    pauseBtn := mainGui.AddButton("x145 y250 w90 h30", "Pausar")\n';
scriptCode += '    pauseBtn.OnEvent("Click", PauseScript)\n';
scriptCode += '    pauseBtn.Name := "PauseButton"\n';
scriptCode += '    pauseBtn.Enabled := false\n\n';

scriptCode += '    reloadBtn := mainGui.AddButton("x250 y250 w90 h30", "Recarregar")\n';
scriptCode += '    reloadBtn.OnEvent("Click", ReloadScript)\n\n';

scriptCode += '    mainGui.SetFont("s8")\n';
scriptCode += '    mainGui.AddText("x20 y290 w340 Center c0x94A3B8", "Desenvolvido por cralw16")\n\n';

scriptCode += '    mainGui.OnEvent("Close", (*) => ExitApp())\n';
scriptCode += '    mainGui.Title := "AutoScript RCC"\n';
scriptCode += '    mainGui.Show("w380 h320")\n\n';

scriptCode += '    SetTimer CheckConfigFile, 5000\n';
scriptCode += '}\n\n';

scriptCode += 'UpdateSpeed(guiCtrl, *) {\n';
scriptCode += '    global sleepTime\n';
scriptCode += '    Critical "On"\n';
scriptCode += '    sleepTime := guiCtrl.Value * 1000\n';
scriptCode += '    guiCtrl.Gui["SpeedText"].Text := "Intervalo: " guiCtrl.Value ".0 segundos"\n';
scriptCode += '    Critical "Off"\n';
scriptCode += '}\n\n';

scriptCode += 'StartScript(*) {\n';
scriptCode += '    Critical "On"\n';
scriptCode += '    mainGui["StartButton"].Enabled := false\n';
scriptCode += '    mainGui["PauseButton"].Enabled := true\n';
scriptCode += '    mainGui["PauseButton"].Text := "Pausar"\n';
scriptCode += '    isPaused := 0\n';
scriptCode += '    UpdateStatusMessage("Script será iniciado em 5 segundos...")\n';
scriptCode += '    Critical "Off"\n';
scriptCode += '    Sleep 5000\n';
scriptCode += '    if (!isPaused) {\n';
scriptCode += '        UpdateStatusMessage("Script ativo")\n';
scriptCode += '        SetTimer SendNextText, -100\n';
scriptCode += '    }\n';
scriptCode += '}\n\n';

scriptCode += 'PauseScript(*) {\n';
scriptCode += '    Critical "On"\n';
scriptCode += '    if (!isPaused) {\n';
scriptCode += '        isPaused := 1\n';
scriptCode += '        SetTimer SendNextText, 0\n';
scriptCode += '        mainGui["PauseButton"].Text := "Continuar"\n';
scriptCode += '        UpdateStatusMessage("Script Pausado")\n';
scriptCode += '    } else {\n';
scriptCode += '        if (!FileExist(configFile)) {\n';
scriptCode += '            MsgBox("Arquivo de configuração não encontrado. O script será recarregado.", "Erro", "0x10")\n';
scriptCode += '            Reload\n';
scriptCode += '            return\n';
scriptCode += '        }\n';
scriptCode += '        UpdateStatusMessage("Script será reiniciado em 5 segundos...")\n';
scriptCode += '        Critical "Off"\n';
scriptCode += '        Sleep 5000\n';
scriptCode += '        Critical "On"\n';
scriptCode += '        isPaused := 0\n';
scriptCode += '        mainGui["PauseButton"].Text := "Pausar"\n';
scriptCode += '        UpdateStatusMessage("Script Ativo")\n';
scriptCode += '        SetTimer SendNextText, -100\n';
scriptCode += '    }\n';
scriptCode += '    Critical "Off"\n';
scriptCode += '}\n\n';

scriptCode += 'ReloadScript(*) {\n';
scriptCode += '    SetTimer SendNextText, 0\n';
scriptCode += '    SetTimer CheckConfigFile, 0\n';
scriptCode += '    Reload\n';
scriptCode += '}\n\n';

scriptCode += 'CheckConfigFile() {\n';
scriptCode += '    if (!FileExist(configFile)) {\n';
scriptCode += '        SetTimer SendNextText, 0\n';
scriptCode += '        SetTimer CheckConfigFile, 0\n';
scriptCode += '        MsgBox("Arquivo de configuração não encontrado.`nO script será recarregado para configuração do nickname.", "Erro", "0x10")\n';
scriptCode += '        if WinExist("AutoScript RCC") {\n';
scriptCode += '            WinClose\n';
scriptCode += '        }\n';
scriptCode += '        isGuiActive := 0\n';
scriptCode += '        ShowNicknameGui()\n';
scriptCode += '    }\n';
scriptCode += '}\n\n';

scriptCode += 'ShowQuestion(*) {\n';
scriptCode += '    global waitingAnswer, questionGui\n\n';

scriptCode += '    if (waitingAnswer) {\n';
scriptCode += '        try {\n';
scriptCode += '            mainPos := mainGui.GetPos()\n';
scriptCode += '            questionX := mainPos.x + 400\n';
scriptCode += '            questionY := mainPos.y\n';
scriptCode += '        } catch Error {\n';
scriptCode += '            questionX := A_ScreenWidth // 2 - 110\n';
scriptCode += '            questionY := A_ScreenHeight // 2 - 50\n';
scriptCode += '        }\n\n';

scriptCode += '        questionGui := Gui("+AlwaysOnTop +ToolWindow")\n';
scriptCode += '        questionGui.BackColor := "0x1E293B"\n';
scriptCode += '        questionGui.SetFont("s10 bold", "Segoe UI")\n\n';

scriptCode += '        questionGui.AddText("x20 y20 w200 c0xE2E8F0", "O aluno respondeu a pergunta?")\n';
scriptCode += '        questionGui.SetFont("s10 normal")\n\n';

scriptCode += '        btnYes := questionGui.AddButton("x20 y60 w80 h30 Default", "Sim")\n';
scriptCode += '        btnYes.OnEvent("Click", AnswerYes)\n\n';

scriptCode += '        btnNo := questionGui.AddButton("x110 y60 w80 h30", "Não")\n';
scriptCode += '        btnNo.OnEvent("Click", AnswerNo)\n\n';

scriptCode += '        questionGui.OnEvent("Close", (*) => questionGui.Destroy())\n';
scriptCode += '        questionGui.Title := "Confirmação"\n';
scriptCode += '        questionGui.Show(Format("x{1} y{2} w220 h100", questionX, questionY))\n';
scriptCode += '    }\n';
scriptCode += '}\n\n';

scriptCode += 'AnswerYes(*) {\n';
scriptCode += '    global waitingAnswer, questionGui\n\n';

scriptCode += '    if (!waitingAnswer) {\n';
scriptCode += '        questionGui.Destroy()\n';
scriptCode += '        return\n';
scriptCode += '    }\n\n';

scriptCode += '    questionGui.Destroy()\n';
scriptCode += '    UpdateStatusMessage("Script será reiniciado em 5 segundos...")\n';
scriptCode += '    Sleep(5000)\n\n';

scriptCode += '    if (FileExist(configFile)) {\n';
scriptCode += '        UpdateStatusMessage("Script ativo")\n';
scriptCode += '        isPaused := 0\n';
scriptCode += '        textIndex := waitingAnswer + 1\n';
scriptCode += '        waitingAnswer := 0\n';
scriptCode += '        SetTimer(SendNextText, -100)\n';
scriptCode += '    } else {\n';
scriptCode += '        MsgBox("Arquivo de configuração não encontrado. O script será recarregado.", "Erro", "0x10")\n';
scriptCode += '        Reload\n';
scriptCode += '    }\n';
scriptCode += '}\n\n';

scriptCode += 'AnswerNo(*) {\n';
scriptCode += '    global waitingAnswer, questionGui\n\n';

scriptCode += '    if (!waitingAnswer) {\n';
scriptCode += '        questionGui.Destroy()\n';
scriptCode += '        return\n';
scriptCode += '    }\n\n';

scriptCode += '    questionGui.Destroy()\n';
scriptCode += '    isPaused := 1\n';
scriptCode += '}\n\n';

scriptCode += 'SendNextText() {\n';
scriptCode += '    global textIndex, waitingAnswer, isPaused, sleepTime, userNickname\n\n';
scriptCode += '    if (isPaused) {\n';
scriptCode += '        SetTimer(() => SendNextText(), 0)\n';
scriptCode += '        return\n';
scriptCode += '    }\n\n';

scriptCode += '    static processedText := [\n';

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
                .replace(/\\/g, "\\")
                .replace(/\{/g, "{{}")
                .replace(/\}/g, "{}}")
                .replace(/\r/g, "")
                .replace(/\n/g, "")
                .replace(/[%]/g, "`%");

            scriptCode += `if (textIndex = ${currentIndex}) {\n`;
            scriptCode += `    if (isPaused) {\n`;
            scriptCode += `        SetTimer(() => SendNextText(), 0)\n`;
            scriptCode += `        Critical("Off")\n`;
            scriptCode += `        return\n`;
            scriptCode += `    }\n`;

            if (/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s*]+$/.test(chunk)) {
                scriptCode += `    Sleep(1000)\n`;
            }

            scriptCode += `    Send(StrReplace("${escapedChunk}", "{username}", userNickname))\n`;
            scriptCode += `    Send("{Shift Down}{Enter}{Shift Up}")\n`;

            if (chunk.includes('?')) {
                scriptCode += `    waitingAnswer := ${currentIndex}\n`;
                scriptCode += `    Critical("Off")\n`;
                scriptCode += `    ShowQuestion()\n`;
                scriptCode += `    return\n`;
            } else {
                scriptCode += `    Sleep(sleepTime)\n`;
                scriptCode += `    textIndex := ${currentIndex + 1}\n`;
                scriptCode += `    Critical("Off")\n`;
                scriptCode += `    SetTimer(() => SendNextText(), -100)\n`;
            }
            scriptCode += `}\n\n`;
            currentIndex++;
        }
    });
});

scriptCode += `Critical("Off")\n\n`;

scriptCode += `; Event handlers for GUI closure\n`;
scriptCode += `OnExit((*) => {\n`;
scriptCode += `    Critical("On")\n`;
scriptCode += `    SetTimer(() => SendNextText(), 0)\n`;
scriptCode += `    SetTimer(() => CheckConfigFile(), 0)\n`;
scriptCode += `    ExitApp\n`;
scriptCode += `})\n`;

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

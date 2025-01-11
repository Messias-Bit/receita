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
            if (!text || typeof text !== 'string') {
                return '';
            }
            return text
                .replace(/`/g, '``')
                .replace(/%/g, '`%')
                .replace(/\^/g, '`^')
                .replace(/!/g, '`!')
                .replace(/#/g, '`#')
                .replace(/\+/g, '`+')
                .replace(/\\/g, '`\\');
        }

        let scriptCode = `#Requires AutoHotkey v2.0\n`;
scriptCode += `#SingleInstance Force\n`;
scriptCode += `SetWorkingDir(A_ScriptDir)\n\n`;

scriptCode += `class Theme {\n`;
scriptCode += `    static Background := "1E293B"\n`;
scriptCode += `    static Text := "FFFFFF"\n`;
scriptCode += `    static Accent := "3B82F6"\n`;
scriptCode += `    static ButtonHover := "2563EB"\n`;
scriptCode += `    static Muted := "94A3B8"\n`;
scriptCode += `    static Error := "FF4444"\n`;
scriptCode += `}\n\n`;

scriptCode += `global isPaused := 0\n`;
scriptCode += `global sleepTime := 6000\n`;
scriptCode += `global textIndex := 1\n`;
scriptCode += `global waitingAnswer := 0\n`;
scriptCode += `global username := ""\n`;
scriptCode += `global configCheckAttempts := 0\n\n`;

scriptCode += `try {\n`;
scriptCode += `    username := IniRead("config.ini", "Configuracao", "Username")\n`;
scriptCode += `} catch Error as e {\n`;
scriptCode += `    username := ""\n`;
scriptCode += `}\n\n`;

scriptCode += `if (StrLen(username) > 25) {\n`;
scriptCode += `    MsgBox("Erro: Nome de usuário muito longo.", "Erro")\n`;
scriptCode += `    username := ""\n`;
scriptCode += `    ShowConfigGUI()\n`;
scriptCode += `    ExitApp()\n`;
scriptCode += `}\n\n`;

scriptCode += `ShowMainGUI() {\n`;
scriptCode += `    global MainGui := Gui()\n`;
scriptCode += `    MainGui.Opt("+AlwaysOnTop -DPIScale")\n`;
scriptCode += `    MainGui.BackColor := Theme.Background\n`;
scriptCode += `    MainGui.MarginX := 20\n`;
scriptCode += `    MainGui.MarginY := 20\n\n`;

scriptCode += `    MainGui.SetFont("s12 bold", "Segoe UI")\n`;
scriptCode += `    MainGui.AddText("x20 y20 w340 h30 Center c" Theme.Text, "AutoScript RCC - Controle")\n\n`;

scriptCode += `    MainGui.SetFont("s10")\n`;
scriptCode += `    controlsGroup := MainGui.AddGroupBox("x20 y60 w340 h180 c" Theme.Text, "Controles")\n\n`;

scriptCode += `    MainGui.AddText("x40 y90 c" Theme.Text, "Velocidade do Script:")\n`;
scriptCode += `    speedSlider := MainGui.AddSlider("x40 y110 w300 Range6-8", 6)\n`;
scriptCode += `    speedText := MainGui.AddText("x40 y140 w300 c" Theme.Text, "Intervalo: 6.0 segundos")\n`;
scriptCode += `    speedSlider.OnEvent("Change", (ctrl, *) => {\n`;
scriptCode += `        value := ctrl.Value\n`;
scriptCode += `        sleepTime := value * 1000\n`;
scriptCode += `        speedText.Text := "Intervalo: " value ".0 segundos"\n`;
scriptCode += `    })\n\n`;

scriptCode += `    startBtn := MainGui.AddButton("x40 y170 w90 h30", "Iniciar")\n`;
scriptCode += `    startBtn.SetFont("s10 bold")\n`;
scriptCode += `    startBtn.OnEvent("Click", StartScript)\n`;
scriptCode += `    startBtn.OnEvent("MouseEnter", (*) => startBtn.Opt("+Background" Theme.ButtonHover))\n`;
scriptCode += `    startBtn.OnEvent("MouseLeave", (*) => startBtn.Opt("+Background" Theme.Accent))\n\n`;

scriptCode += `    pauseBtn := MainGui.AddButton("x145 y170 w90 h30 Disabled", "Pausar")\n`;
scriptCode += `    pauseBtn.SetFont("s10")\n`;
scriptCode += `    pauseBtn.OnEvent("Click", PauseScript)\n`;
scriptCode += `    pauseBtn.OnEvent("MouseEnter", (*) => pauseBtn.Opt("+Background" Theme.ButtonHover))\n`;
scriptCode += `    pauseBtn.OnEvent("MouseLeave", (*) => pauseBtn.Opt("+Background" Theme.Accent))\n\n`;

scriptCode += `    reloadBtn := MainGui.AddButton("x250 y170 w90 h30", "Recarregar")\n`;
scriptCode += `    reloadBtn.SetFont("s10")\n`;
scriptCode += `    reloadBtn.OnEvent("Click", (*) => Reload())\n`;
scriptCode += `    reloadBtn.OnEvent("MouseEnter", (*) => reloadBtn.Opt("+Background" Theme.ButtonHover))\n`;
scriptCode += `    reloadBtn.OnEvent("MouseLeave", (*) => reloadBtn.Opt("+Background" Theme.Accent))\n\n`;

scriptCode += `    MainGui.SetFont("s9 bold")\n`;
scriptCode += `    statusText := MainGui.AddText("x20 y250 w340 h30 Center c" Theme.Error, "")\n\n`;

scriptCode += `    MainGui.SetFont("s8")\n`;
scriptCode += `    MainGui.AddText("x20 y290 w340 Center c" Theme.Muted, "Desenvolvido por cralw16")\n\n`;

scriptCode += `    MainGui.OnEvent("Close", GuiClose)\n`;
scriptCode += `    MainGui.Show("w380 h330")\n`;
scriptCode += `}\n\n`;

scriptCode += `CreateQuestionGui() {\n`;
scriptCode += `    global QuestionGui := Gui()\n`;
scriptCode += `    QuestionGui.Opt("+AlwaysOnTop +ToolWindow -SysMenu -DPIScale")\n`;
scriptCode += `    QuestionGui.BackColor := Theme.Background\n`;
scriptCode += `    QuestionGui.MarginX := 20\n`;
scriptCode += `    QuestionGui.MarginY := 20\n\n`;

scriptCode += `    QuestionGui.SetFont("s10 bold", "Segoe UI")\n`;
scriptCode += `    QuestionGui.AddText("x20 y20 w200 h30 c" Theme.Text, "O aluno respondeu a pergunta?")\n\n`;

scriptCode += `    yesBtn := QuestionGui.AddButton("x20 y60 w80 h30", "Sim")\n`;
scriptCode += `    yesBtn.SetFont("s10 bold")\n`;
scriptCode += `    yesBtn.OnEvent("Click", AnswerYes)\n`;
scriptCode += `    yesBtn.OnEvent("MouseEnter", (*) => yesBtn.Opt("+Background" Theme.ButtonHover))\n`;
scriptCode += `    yesBtn.OnEvent("MouseLeave", (*) => yesBtn.Opt("+Background" Theme.Accent))\n\n`;

scriptCode += `    noBtn := QuestionGui.AddButton("x110 y60 w80 h30", "Não")\n`;
scriptCode += `    noBtn.SetFont("s10")\n`;
scriptCode += `    noBtn.OnEvent("Click", AnswerNo)\n`;
scriptCode += `    noBtn.OnEvent("MouseEnter", (*) => noBtn.Opt("+Background" Theme.ButtonHover))\n`;
scriptCode += `    noBtn.OnEvent("MouseLeave", (*) => noBtn.Opt("+Background" Theme.Accent))\n`;
scriptCode += `}\n\n`;

scriptCode += `ShowConfigGUI() {\n`;
scriptCode += `    global ConfigGui := Gui()\n`;
scriptCode += `    ConfigGui.Opt("+AlwaysOnTop -DPIScale")\n`;
scriptCode += `    ConfigGui.BackColor := Theme.Background\n`;
scriptCode += `    ConfigGui.MarginX := 25\n`;
scriptCode += `    ConfigGui.MarginY := 25\n\n`;

scriptCode += `    ConfigGui.SetFont("s12 bold", "Segoe UI")\n`;
scriptCode += `    header := ConfigGui.AddText("x20 y20 w300 Center c" Theme.Text " Hidden", "Configuração Inicial")\n`;
scriptCode += `    SetTimer(() => header.Visible := true, -100)\n\n`;

scriptCode += `    ConfigGui.SetFont("s10")\n`;
scriptCode += `    ConfigGui.AddText("x20 y70 w300 c" Theme.Text, "Digite seu nickname:")\n`;
scriptCode += `    nickEdit := ConfigGui.AddEdit("x20 y100 w300 h35")\n`;
scriptCode += `    nickEdit.Opt("+Background" Theme.Background " c" Theme.Text)\n\n`;

scriptCode += `    confirmBtn := ConfigGui.AddButton("x95 y150 w150 h40", "Confirmar")\n`;
scriptCode += `    confirmBtn.SetFont("s10 bold")\n`;
scriptCode += `    confirmBtn.OnEvent("Click", ConfirmNick)\n`;
scriptCode += `    confirmBtn.OnEvent("MouseEnter", (*) => confirmBtn.Opt("+Background" Theme.ButtonHover))\n`;
scriptCode += `    confirmBtn.OnEvent("MouseLeave", (*) => confirmBtn.Opt("+Background" Theme.Accent))\n\n`;

scriptCode += `    ConfigGui.Show("w340 h220")\n`;
scriptCode += `}\n\n`;

scriptCode += `ShowWarningGUI() {\n`;
scriptCode += `    global WarningGui := Gui()\n`;
scriptCode += `    WarningGui.Opt("+AlwaysOnTop -DPIScale")\n`;
scriptCode += `    WarningGui.BackColor := Theme.Background\n`;
scriptCode += `    WarningGui.MarginX := 25\n`;
scriptCode += `    WarningGui.MarginY := 25\n\n`;

scriptCode += `    WarningGui.SetFont("s16", "Segoe MDL2 Assets")\n`;
scriptCode += `    WarningGui.AddText("x20 y20 w360 Center c" Theme.Accent, "⚠")\n\n`;

scriptCode += `    WarningGui.SetFont("s12 bold", "Segoe UI")\n`;
scriptCode += `    title := WarningGui.AddText("x20 y50 w360 Center c" Theme.Text " Hidden", "Aviso Importante")\n`;
scriptCode += `    SetTimer(() => title.Visible := true, -100)\n\n`;

scriptCode += `    WarningGui.SetFont("s10")\n`;
scriptCode += `    msg := WarningGui.AddText("x20 y90 w360 Center c" Theme.Muted " Hidden", "Foi criado um arquivo config.ini no mesmo local deste script. Por favor, não exclua este arquivo, pois ele guarda suas configurações de nickname.")\n`;
scriptCode += `    SetTimer(() => msg.Visible := true, -200)\n\n`;

scriptCode += `    okBtn := WarningGui.AddButton("x145 y170 w110 h35", "Entendi")\n`;
scriptCode += `    okBtn.SetFont("s10")\n`;
scriptCode += `    okBtn.OnEvent("Click", ConfirmWarning)\n`;
scriptCode += `    okBtn.OnEvent("MouseEnter", (*) => okBtn.Opt("+Background" Theme.ButtonHover))\n`;
scriptCode += `    okBtn.OnEvent("MouseLeave", (*) => okBtn.Opt("+Background" Theme.Accent))\n\n`;

scriptCode += `    WarningGui.Show("w400 h230")\n`;
scriptCode += `}\n\n`;

scriptCode += `FadeIn(control, duration := 300) {\n`;
scriptCode += `    control.Visible := true\n`;
scriptCode += `    control.Transparent := 0\n`;
scriptCode += `    Loop 10 {\n`;
scriptCode += `        control.Transparent += 25.5\n`;
scriptCode += `        Sleep(duration/10)\n`;
scriptCode += `    }\n`;
scriptCode += `}\n\n`;

scriptCode += `StartScript(*) {\n`;
scriptCode += `    if (username == "") {\n`;
scriptCode += `        UpdateStatusMessage("Erro: Nome de usuário não configurado")\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n`;
scriptCode += `    startBtn.Enabled := false\n`;
scriptCode += `    pauseBtn.Enabled := true\n`;
scriptCode += `    isPaused := 0\n`;
scriptCode += `    UpdateStatusMessage("Script será iniciado em 5 segundos...")\n`;
scriptCode += `    Sleep(5000)\n`;
scriptCode += `    UpdateStatusMessage("Script ativo")\n`;
scriptCode += `    SetTimer(SendNextText, -100)\n`;
scriptCode += `}\n\n`;

scriptCode += `PauseScript(*) {\n`;
scriptCode += `    if (waitingAnswer)\n`;
scriptCode += `        return\n`;
scriptCode += `    if (!isPaused) {\n`;
scriptCode += `        isPaused := 1\n`;
scriptCode += `        SetTimer(SendNextText, 0)\n`;
scriptCode += `        pauseBtn.Text := "Continuar"\n`;
scriptCode += `        UpdateStatusMessage("Script Pausado")\n`;
scriptCode += `    } else {\n`;
scriptCode += `        UpdateStatusMessage("Script será reiniciado em 5 segundos...")\n`;
scriptCode += `        Sleep(5000)\n`;
scriptCode += `        isPaused := 0\n`;
scriptCode += `        pauseBtn.Text := "Pausar"\n`;
scriptCode += `        UpdateStatusMessage("Script Ativo")\n`;
scriptCode += `        SetTimer(SendNextText, -100)\n`;
scriptCode += `    }\n`;
scriptCode += `}\n\n`;

scriptCode += `ShowQuestion(*) {\n`;
scriptCode += `    try {\n`;
scriptCode += `        winPos := MainGui.GetPos()\n`;
scriptCode += `        confirmX := winPos.x + 400\n`;
scriptCode += `        isPaused := 1\n`;
scriptCode += `        SetTimer(SendNextText, 0)\n`;
scriptCode += `        QuestionGui.Show("x" confirmX " y" winPos.y " w220 h100")\n`;
scriptCode += `        UpdateStatusMessage("Script pausado, aguardando resposta do aluno...")\n`;
scriptCode += `    } catch Error as e {\n`;
scriptCode += `        MsgBox("Erro ao posicionar janela de confirmação.")\n`;
scriptCode += `    }\n`;
scriptCode += `}\n\n`;

scriptCode += `AnswerYes(*) {\n`;
scriptCode += `    if (!waitingAnswer)\n`;
scriptCode += `        return\n`;
scriptCode += `    QuestionGui.Hide()\n`;
scriptCode += `    UpdateStatusMessage("Script será reiniciado em 5 segundos...")\n`;
scriptCode += `    Sleep(5000)\n`;
scriptCode += `    isPaused := 0\n`;
scriptCode += `    textIndex := waitingAnswer + 1\n`;
scriptCode += `    waitingAnswer := 0\n`;
scriptCode += `    UpdateStatusMessage("Script ativo")\n`;
scriptCode += `    SetTimer(SendNextText, -100)\n`;
scriptCode += `}\n\n`;

scriptCode += `AnswerNo(*) {\n`;
scriptCode += `    QuestionGui.Hide()\n`;
scriptCode += `    waitingAnswer := 0\n`;
scriptCode += `    UpdateStatusMessage("")\n`;
scriptCode += `}\n\n`;

scriptCode += `ConfirmNick(*) {\n`;
scriptCode += `    newNick := nickEdit.Value\n`;
scriptCode += `    if (newNick == "" || RegExMatch(newNick, "[/\\\\:*?\"<>|]")) {\n`;
scriptCode += `        MsgBox("Por favor, digite um nickname válido sem caracteres especiais.")\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n`;
scriptCode += `    if (StrLen(newNick) > 25) {\n`;
scriptCode += `        MsgBox("Erro: Nome de usuário muito longo. Máximo 25 caracteres.")\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n`;
scriptCode += `    username := newNick\n`;
scriptCode += `    try {\n`;
scriptCode += `        IniWrite(username, "config.ini", "Configuracao", "Username")\n`;
scriptCode += `        ConfigGui.Destroy()\n`;
scriptCode += `        ShowWarningGUI()\n`;
scriptCode += `    } catch Error as e {\n`;
scriptCode += `        MsgBox("Erro ao salvar configurações. Verifique as permissões da pasta.")\n`;
scriptCode += `    }\n`;
scriptCode += `}\n\n`;

scriptCode += `ConfirmWarning(*) {\n`;
scriptCode += `    WarningGui.Destroy()\n`;
scriptCode += `    if (!FileExist("config.ini")) {\n`;
scriptCode += `        MsgBox("Erro: Arquivo de configuração não encontrado.")\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n`;
scriptCode += `    ShowMainGUI()\n`;
scriptCode += `    SetTimer(CheckConfigFile, 1000)\n`;
scriptCode += `}\n\n`;

scriptCode += `UpdateStatusMessage(message) {\n`;
scriptCode += `    statusText.Text := message\n`;
scriptCode += `    if (message != "") {\n`;
scriptCode += `        SetTimer(() => statusText.Text := "", -4000)\n`;
scriptCode += `    }\n`;
scriptCode += `}\n\n`;

scriptCode += `CheckConfigFile(*) {\n`;
scriptCode += `    configCheckAttempts += 1\n`;
scriptCode += `    if (configCheckAttempts > 5) {\n`;
scriptCode += `        SetTimer(CheckConfigFile, 0)\n`;
scriptCode += `        MsgBox("Erro: Não foi possível verificar o arquivo de configuração após várias tentativas.")\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n`;
scriptCode += `    if !FileExist("config.ini") {\n`;
scriptCode += `        SetTimer(CheckConfigFile, 0)\n`;
scriptCode += `        MainGui.Hide()\n`;
scriptCode += `        username := ""\n`;
scriptCode += `        ShowConfigGUI()\n`;
scriptCode += `    }\n`;
scriptCode += `}\n\n`;

scriptCode += `GuiClose(thisGui, *) {\n`;
scriptCode += `    result := MsgBox("Deseja realmente fechar o script?",, "YesNo")\n`;
scriptCode += `    if (result = "Yes") {\n`;
scriptCode += `        SetTimer(SendNextText, 0)\n`;
scriptCode += `        SetTimer(CheckConfigFile, 0)\n`;
scriptCode += `        ExitApp()\n`;
scriptCode += `    }\n`;
scriptCode += `}\n\n`;

scriptCode += `SendNextText(*) {\n`;
scriptCode += `    if (isPaused = 1) {\n`;
scriptCode += `        SetTimer(SendNextText, 0)\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n\n`;

scriptCode += `    if (textIndex = 1) {\n`;
scriptCode += `        if (isPaused = 1) {\n`;
scriptCode += `            SetTimer(SendNextText, 0)\n`;
scriptCode += `            return\n`;
scriptCode += `        }\n`;
scriptCode += `        Send("{Raw}exemplo")\n`;
scriptCode += `        Send("{Shift Down}{Enter}{Shift Up}")\n`;
scriptCode += `        Sleep(sleepTime)\n`;
scriptCode += `        textIndex := 2\n`;
scriptCode += `        SetTimer(SendNextText, -100)\n`;
scriptCode += `    }\n`;
scriptCode += `}\n\n`;

scriptCode += `CreateQuestionGui()\n`;
scriptCode += `if (username = "") {\n`;
scriptCode += `    ShowConfigGUI()\n`;
scriptCode += `} else {\n`;
scriptCode += `    ShowMainGUI()\n`;
scriptCode += `}\n\n`;

scriptCode += `SetTimer(CheckConfigFile, 1000)\n`;


        
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

scriptCode += `SendNextText(*) {\n`;
scriptCode += `    if (isPaused || username = "" || A_LastError) {\n`;
scriptCode += `        SetTimer(SendNextText, 0)\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n`;
scriptCode += `    if (textIndex > ${currentIndex - 1}) {\n`;
scriptCode += `        SetTimer(SendNextText, 0)\n`;
scriptCode += `        startBtn.Enabled := true\n`;
scriptCode += `        pauseBtn.Enabled := false\n`;
scriptCode += `        UpdateStatusMessage("Script finalizado")\n`;
scriptCode += `        return\n`;
scriptCode += `    }\n\n`;

processedLines.forEach(line => {
    const chunks = splitTextIntoChunks(line, 85);
    chunks.forEach(chunk => {
        if (chunk.trim()) {
            scriptCode += `    if (textIndex = ${currentIndex}) {\n`;
            scriptCode += `        if (isPaused) {\n`;
            scriptCode += `            SetTimer(SendNextText, 0)\n`;
            scriptCode += `            return\n`;
            scriptCode += `        }\n`;

            if (/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s*]+$/.test(chunk)) {
                scriptCode += `        Sleep(1000)\n`;
            }

            scriptCode += `        Send("{Raw}" . "${escapeSpecialChars(chunk)}")\n`;
            scriptCode += `        Send("{Shift Down}{Enter}{Shift Up}")\n`;

            if (chunk.includes('?')) {
                scriptCode += `        waitingAnswer := ${currentIndex}\n`;
                scriptCode += `        isPaused := 1\n`;
                scriptCode += `        SetTimer(SendNextText, 0)\n`;
                scriptCode += `        ShowQuestion()\n`;
                scriptCode += `        return\n`;
            } else {
                scriptCode += `        Sleep(sleepTime)\n`;
                scriptCode += `        textIndex := ${currentIndex + 1}\n`;
                scriptCode += `        SetTimer(SendNextText, -100)\n`;
            }
            scriptCode += `    }\n\n`;
            currentIndex++;
                }
            });
        });
        
        scriptCode += `}\n\n`;
        
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

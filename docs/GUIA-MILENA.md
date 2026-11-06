# Guia rápido para a Milena

Este guia explica, sem termos técnicos, como ver o sistema funcionando e como rodar as verificações. Você não precisa entender de programação: o Claude Code escreve e altera o código; você confere o resultado.

## 1. Preparar o computador (uma vez só)

1. Instale o **VS Code**, o **Google Chrome**, o **Node 22** (nodejs.org) e o **Git**.
2. No terminal, ative o gerenciador de pacotes: `corepack enable`.
3. Baixe o projeto: `git clone https://github.com/tiago-brm/ZELLO_CONDOMINIOS.git` e abra a pasta no VS Code.
4. No terminal do VS Code (menu Terminal > Novo Terminal), rode `pnpm install` e espere terminar.

## 2. Ver o visual do sistema (sem login)

1. No VS Code, abra **Executar e Depurar** (ícone de play com um inseto na lateral, ou Ctrl+Shift+D; no Mac, Cmd+Shift+D).
2. No alto, escolha **"1. Ver o visual do sistema (sem login)"** e clique no play verde (ou tecle F5).
3. O Chrome abre sozinho com a vitrine do design system: cores, botões, formulários, avisos e o menu. Use os seletores no topo para trocar entre tema claro e escuro e entre as 4 cores.
4. **Ver no celular:** no Chrome, tecle F12 e depois Ctrl+Shift+M (Cmd+Shift+M no Mac), e escolha larguras de 320, 375 e 414. Nada pode ficar cortado nem aparecer barra de rolagem lateral.
5. Para parar, clique no quadrado vermelho da barra de depuração.

A opção **"2. Abrir o portal"** mostra o sistema completo, mas só funciona depois que o login estiver configurado. Ainda não use.

## 3. Rodar as verificações automáticas

Menu **Terminal > Executar Tarefa...** e escolha:
- **Rodar testes rápidos:** leva poucos segundos.
- **Rodar testes com banco local:** leva cerca de 1 minuto. Ele cria um banco de dados temporário no seu computador e apaga no fim; não precisa instalar nada nem mexer em dado real.

No fim aparece "passed" (passou) ou "FAIL" (falhou). Se falhar, copie a mensagem e mostre ao Claude Code.

## 4. Como pedir mudanças

Abra o Claude Code na pasta do projeto e descreva em português o que quer. O projeto tem regras próprias (visual idêntico ao protótipo, segurança, LGPD), e o Claude Code as lê sozinho. Para algo novo, ele escreve primeiro uma especificação em `docs/specs/` e espera a sua aprovação antes de programar.

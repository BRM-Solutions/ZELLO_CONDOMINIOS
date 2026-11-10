# Guia rápido para a Milena

Este guia explica, sem termos técnicos, como ver o sistema funcionando e como rodar as verificações. Você não precisa entender de programação: o Claude Code escreve e altera o código; você confere o resultado.

## 1. Preparar o computador (Windows, uma vez só)

> Estes passos foram escritos sem testar num Windows de verdade. Se algo falhar, copie a mensagem de erro e mostre ao Claude Code.

1. Instale o **VS Code**, o **Google Chrome**, o **Node 22** (nodejs.org, versão LTS) e o **Git para Windows** (git-scm.com, aceite as opções padrão; ele inclui o "Git Bash", que o Claude Code usa).
2. Abra o **PowerShell normal** (sem "Executar como administrador") e rode: `npm install -g pnpm@9.15.9`.
3. Escolha uma pasta de caminho curto, como `C:\dev`, e baixe o projeto: `git clone https://github.com/tiago-brm/ZELLO_CONDOMINIOS.git`. Depois `cd ZELLO_CONDOMINIOS` e `code .`.
4. No terminal do VS Code (menu Terminal > Novo Terminal), rode `pnpm install` e espere terminar.
5. Uma vez só: `git config --global core.longpaths true` (evita erro de nome de arquivo comprido).

**Importante:** abra o VS Code sempre de forma normal, nunca como administrador.

## 2. Ver o visual do sistema (sem login)

1. No VS Code, abra **Executar e Depurar** (ícone de play com um inseto na lateral, ou Ctrl+Shift+D).
2. No alto, escolha **"1. Ver o visual do sistema (sem login)"** e clique no play verde (ou tecle F5).
3. O Chrome abre sozinho com a vitrine do design system: cores, botões, formulários, avisos e o menu. Use os seletores no topo para trocar entre tema claro e escuro e entre as 4 cores.
4. **Ver no celular:** no Chrome, tecle F12 e depois Ctrl+Shift+M, e escolha larguras de 320, 375 e 414. Nada pode ficar cortado nem aparecer barra de rolagem lateral.
5. Para parar, clique no quadrado vermelho da barra de depuração.

A opção **"2. Abrir o portal"** mostra o sistema completo, mas só funciona depois que o login estiver configurado. Ainda não use.

## 3. Rodar as verificações automáticas

Menu **Terminal > Executar Tarefa...** e escolha:
- **Rodar testes rápidos:** leva poucos segundos.
- **Rodar testes com banco local:** leva cerca de 1 minuto. Ele cria um banco de dados temporário no seu computador e apaga no fim; não precisa instalar nada nem mexer em dado real.

No fim aparece "passed" (passou) ou "FAIL" (falhou). Se falhar, copie a mensagem e mostre ao Claude Code.

## 4. Como pedir mudanças

Abra o Claude Code na pasta do projeto e descreva em português o que quer. O projeto tem regras próprias (visual idêntico ao protótipo, segurança, LGPD), e o Claude Code as lê sozinho. Para algo novo, ele escreve primeiro uma especificação em `docs/specs/` e espera a sua aprovação antes de programar.

## 5. Problemas comuns no Windows

- **"esbuild.exe" ou "postgres.exe" bloqueado** (antivírus, SmartScreen ou regra da empresa): os dois são programas legítimos e de código aberto (o `esbuild` oficial e o Postgres). Não desligue o antivírus. Permita **só** a pasta `node_modules` dentro do projeto (Segurança do Windows > Proteção contra vírus > Gerenciar configurações > Exclusões). Se o computador é da empresa, peça à TI. Não tente contornar o bloqueio.
- **Erro dizendo que o Postgres não pode rodar com permissão de administrador:** feche o VS Code e abra de novo normalmente, sem "Executar como administrador".
- **O Firewall do Windows pergunta sobre `postgres.exe`:** pode cancelar ou permitir só em rede privada. Ele só conversa com o próprio computador.
- **Erro de caminho muito longo:** mova o projeto para uma pasta curta, como `C:\dev`.
- **Nada disso resolveu (ou o Windows bloqueou Git e esbuild):** use o **GitHub Codespaces**, que roda o projeto na nuvem sem instalar nada no seu Windows. No repositório, Code > Codespaces > Create (máquina de 2 núcleos, porta privada). Não desative nenhuma proteção do Windows. Pare o Codespace quando não estiver usando.

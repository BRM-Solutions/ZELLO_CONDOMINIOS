# Lições aprendidas — padrões recorrentes de produção em SaaS multi-tenant

> **Quando ler:** antes de planejar uma feature ou spec, ao revisar um PR, e sempre que algo "estranho" acontecer em teste, deploy ou integração.
> **Resumo:**
> - O incidente mais caro e mais comum: **teste rodando contra o banco de produção**. Separe `dev` e `prod` e trave o ambiente nos testes.
> - Defaults "de desenvolvimento" e mocks chegam a produção se o boot deixar; o boot deve falhar sem segredo, e mock que autentica não existe.
> - Erro de fornecedor pode mentir; registre o que já foi descartado e teste limites de valor cedo.
> - Layout mobile quebra com uma única string longa; `minmax(0, 1fr)` e verificação em 320px são regra.
> - Com IA: spec ancorada em arquivo:linha, "fora de escopo" explícito, subagente para trabalho pesado, decisão de negócio nunca por suposição.
>
> **Relacionados:** [banco](02-banco-de-dados.md), [segurança](03-seguranca.md), [boas práticas](04-boas-praticas.md), [backend](05-backend-api.md), [frontend](06-frontend.md), [testes](07-testes.md), [deploy](09-deploy-easypanel-supabase.md), [workflow Claude](10-workflow-claude.md)

Estes são padrões de falha que se repetem em SaaS multi-tenant com esta stack (Express + `pg` + Vite/React + Postgres, deploy em container). Cada item tem o formato **Sintoma → Causa → Regra → Onde aplicar**. Lição nova do seu projeto entra aqui no mesmo formato, e a regra derivada vai para o doc dono do assunto.

## Banco e testes

**1. Teste que quebra a produção**
- Sintoma: um cliente real conclui uma ação e não recebe a notificação; toda a entrega de mensagens para em silêncio.
- Causa: um teste sobrescreve a linha singleton de configuração global (URL de uma integração) com valor fake e restaura no `afterAll`; a execução é interrompida antes do `afterAll`. Banco de teste = banco de produção.
- Regra: projetos `dev` e `prod` separados desde o dia 1; trava no setup que aborta se o banco não for `dev` (aqui: `TEST_DATABASE_URL` + allowlist `TEST_ALLOWED_DB_REFS`); configuração global em teste só por override em memória ou transação nunca commitada; em produção, rejeitar valor de config com cara de teste (`.test`, `.local`, não-`https`).
- Onde: [testes](07-testes.md#nunca-tocar-dados-reais), [deploy](09-deploy-easypanel-supabase.md).

**2. Um banco só para tudo amarra segredos**
- Sintoma: a chave de criptografia de colunas não pode ser trocada nem ser diferente entre ambientes.
- Causa: dev e prod no mesmo banco; dados reais cifrados com a chave de dev.
- Regra: segredos distintos por ambiente; trocar chave de criptografia exige migração de re-cifragem verificada, nunca só mudar a variável.
- Onde: [segurança](03-seguranca.md), [deploy](09-deploy-easypanel-supabase.md).

**3. Migrations com número repetido**
- Sintoma: duas migrations `022_*` em branches paralelas.
- Causa: numeração sequencial manual.
- Regra: `supabase/migrations/<timestamp>_<nome>.sql`, forward-only, nunca editar migration aplicada.
- Onde: [banco](02-banco-de-dados.md).

**4. Migrations aplicadas à mão**
- Sintoma: o guia de deploy diz "já aplicadas via psql"; não há registro confiável de qual ambiente tem o quê.
- Causa: sem pipeline de migrations.
- Regra: só o CI aplica (`dev` automático → `prod` por disparo manual); ninguém roda migration em `prod` à mão sem confirmação humana.
- Onde: [deploy](09-deploy-easypanel-supabase.md).

**5. Dado de teste deixado para trás**
- Sintoma: resíduo de fixtures no banco após falhas.
- Causa: `afterAll` com dezenas de `DELETE` sequenciais contra banco remoto estoura o timeout do hook e morre no meio.
- Regra: `on delete cascade` a partir do tenant (um `DELETE`), `hookTimeout` alto, varredura de `test_%` antigos no setup.
- Onde: [testes](07-testes.md#factories-e-tenant-de-teste).

**6. Recurso reservado que nunca é liberado**
- Sintoma: disponibilidade exibida menor que a real.
- Causa: a reserva expirada só é liberada quando o próprio usuário volta à tela; fluxo abandonado segura o recurso para sempre.
- Regra: todo estado com prazo (reserva, convite, link de pagamento) tem varredura independente de acesso, chamada antes de ler disponibilidade e dentro da transação que reserva.
- Onde: [backend](05-backend-api.md#jobs-outbox-e-worker).

**7. Lista com teto fixo**
- Sintoma: admin não vê registros além do 100º.
- Causa: `limit 100` sem paginação.
- Regra: todo endpoint de lista nasce paginado com ordem estável (`created_at, id`).
- Onde: [backend](05-backend-api.md#paginação-filtros-ordenação).

**8. Cache em memória desatualizado**
- Sintoma: depois de trocar a configuração de provedor de um tenant, a API continua usando a antiga.
- Causa: cache por id invalidado só no caminho de código de update; mudança direta no banco não invalida.
- Regra: cache versionado por `updated_at` (ou sem cache). Estado em memória (tokens, rate-limit, cache) quebra com mais de uma réplica ou restart — prefira Postgres.
- Onde: [backend](05-backend-api.md).

**9. Trava de regra aplicada cedo demais ou ampla demais**
- Sintoma: o registro principal do produto não pode mais ser ajustado (reduzir total, trocar modalidade) depois de atingir um limite, mesmo quando o negócio permite.
- Causa: uma constraint específica de um tipo vale para todos os tipos; um campo é bloqueado num estado anterior ao realmente irreversível.
- Regra: constraint condicional ao tipo; bloqueie edição só no ponto sem volta e documente esse ponto na spec.
- Onde: [banco](02-banco-de-dados.md), [domínio](11-dominio.md).

**10. `app.ts` com efeito colateral**
- Sintoma: importar o app em teste inicia consumidores de fila.
- Causa: consumidores disparados no topo do módulo do app.
- Regra: `app.ts` puro; jobs e consumidores só em `index.ts`/`worker.ts`.
- Onde: [backend](05-backend-api.md#appts-vs-indexts-vs-workerts).

## Segurança

**11. Mock que autentica em produção** (crítico)
- Sintoma: qualquer pessoa consegue ver dados de qualquer cliente informando um código fixo.
- Causa: verificação por SMS fica como mock com código literal "até depois"; só a resposta HTTP esconde o código em produção.
- Regra: nenhum mock em caminho de autenticação/autorização; fakes só por injeção em `NODE_ENV=test`, e o boot de produção falha se o provedor real não estiver configurado.
- Onde: [segurança](03-seguranca.md).

**12. Senha real no `.env.example`** (crítico)
- Sintoma: credencial de infraestrutura no histórico do git desde o primeiro commit.
- Causa: `.env.example` preenchido copiando o `.env`.
- Regra: `.env.example` só com nomes e placeholders; vazou → rotacionar a credencial no serviço, apagar do arquivo não basta. `*.p12`, `*.pem`, `.env*` no `.gitignore` desde o commit inicial (certificados soltos em pasta de docs são o mesmo risco).
- Onde: [boas práticas](04-boas-praticas.md#git), [segurança](03-seguranca.md).

**13. IDOR por papel baixo** (alto)
- Sintoma: papel de menor privilégio lista dados de todos os outros clientes.
- Causa: rota de listagem checa "é admin?" e não "de qual tenant?".
- Regra: todo SQL filtra pelo tenant do `membership`; RLS como segunda barreira; teste negativo de outro tenant em toda rota.
- Onde: [backend](05-backend-api.md#withtenanttx), [testes](07-testes.md#o-que-testar-obrigatoriamente).

**14. SSRF e URLs sem esquema validado** (alto/baixo)
- Sintoma: campo de URL livre é buscado pelo servidor sem restrição de host; outro schema aceita `javascript:`/`data:`.
- Causa: `z.string()` em vez de URL com allowlist.
- Regra: o servidor não busca URL fornecida pelo usuário; se precisar, allowlist de host + `https:`; upload em vez de URL.
- Onde: [segurança](03-seguranca.md), [boas práticas](04-boas-praticas.md#validação).

**15. Defaults inseguros passando em produção** (médio)
- Sintoma: webhook aceita chamada sem segredo; chave de criptografia e URL de fila com default de dev.
- Causa: `z.string().default("")` sem checagem por ambiente.
- Regra: `superRefine` exige cada segredo em `production`; nenhum default com host/credencial real no código.
- Onde: [backend](05-backend-api.md#config-por-env).

**16. Ações sensíveis sem rastro** (baixo)
- Sintoma: falha de login e troca de credencial de provedor não deixam registro.
- Regra: `audit_log` para login falho, mudança de papel, troca de credencial/ambiente, exportação de dados pessoais.
- Onde: [banco](02-banco-de-dados.md), [segurança](03-seguranca.md).

**17. Superfície exposta sem perceber**
- Sintoma: RLS incompleta e grants para `anon`/`authenticated` num banco que "não usava" a API de dados do Supabase.
- Regra: **no Supabase a Data API (PostgREST) expõe schemas com a chave pública**, que está no bundle do front. Desligue a Data API (ou não exponha o schema `app`) e mantenha RLS deny-by-default em toda tabela mesmo assim `[verificar opção no painel]`.
- Onde: [segurança](03-seguranca.md), [banco](02-banco-de-dados.md).

**18. Rate-limit que não limita**
- Sintoma: limites por IP e por login guardados em memória, com `req.ip` sem `trust proxy` (todo mundo vira o IP do proxy).
- Regra: `trust proxy` configurado atrás do proxy; store compartilhado quando houver mais de uma réplica.
- Onde: [backend](05-backend-api.md#cadeia-de-middlewares-contrato).

## Deploy e configuração

**19. Build arg ignorado silenciosamente**
- Sintoma: mudar a variável no painel não muda nada; builds com o mesmo hash.
- Causa: `ARG X=false` com default no Dockerfile do web.
- Regra: `ARG` sem default para `VITE_*`; o app valida no boot que as variáveis existem.
- Onde: [frontend](06-frontend.md#variáveis-de-build), [deploy](09-deploy-easypanel-supabase.md).

**20. `VITE_*` é build-time**
- Regra: trocar URL de API/Supabase no front exige rebuild, não restart. Configure antes do primeiro deploy.

**21. Contexto de build na raiz**
- Sintoma: build quebra no Easypanel; `.dockerignore` da app ignorado.
- Causa: o Easypanel builda com a raiz do repo como contexto.
- Regra: `COPY` com caminhos a partir da raiz; um `.dockerignore` na raiz.
- Onde: [deploy](09-deploy-easypanel-supabase.md).

**22. Erro de CORS que não é CORS**
- Sintoma: navegador mostra erro de CORS numa chamada que depende de serviço externo lento.
- Causa: chamada externa sem timeout; o proxy derruba a conexão sem resposta (e sem headers CORS).
- Regra: timeout explícito em toda chamada HTTP de saída e erro claro ao usuário.
- Onde: [backend](05-backend-api.md#config-por-env).

**23. Flag de teste ligada por default**
- Sintoma: risco de fluxo simulado (pagamento fake, verificação pulada) em produção, dependente só de env.
- Regra: flag que habilita atalho de teste tem default **desligado** e o boot de `production` recusa ligada.

**24. Renomear infraestrutura não é trocar texto**
- Sintoma: pedido de "remover o nome antigo de tudo".
- Causa: bucket, domínio e credenciais carregam o nome; credencial não é "nome": trocar a string sem rotacionar no serviço só quebra a conexão.
- Regra: renomear storage exige migração de objetos; domínio exige DNS; credencial exige rotação. Escopo explícito do que **não** muda.

**25. Sem graceful shutdown**
- Sintoma: itens presos em "processando" após deploy.
- Regra: tratar `SIGTERM` (parar jobs, `server.close`, `pool.end`) **e** manter rotina que devolve itens abandonados à fila.
- Onde: [backend](05-backend-api.md#appts-vs-indexts-vs-workerts).

**26. Benchmark medido do lugar errado**
- Sintoma: números de concorrência muito piores que o real.
- Causa: medido do notebook contra o banco remoto (um `select 1` leva quase 1s).
- Regra: medir de dentro do ambiente deployado.

## Pagamentos e webhooks

**27. Erro do provedor que mente**
- Sintoma: o provedor responde "cobrança não está ativa" numa operação sobre cobrança comprovadamente ativa.
- Causa real: valor abaixo do mínimo aceito pelo provedor para aquela operação.
- Regra: spec de investigação com lista "já descartado (não repetir)"; testar valores-limite cedo; ler limites comerciais do provedor; acionar suporte com ids reais.
- Onde: [workflow Claude](10-workflow-claude.md), [spec-template](templates/spec-template.md).

**28. Repasse zerado por configuração**
- Sintoma: parte do recebedor final igual a zero.
- Causa: taxa fixa por item maior que o preço do item.
- Regra: invariantes validadas no servidor e testadas: cada parte ≥ 0, soma das partes = total, em centavos.
- Onde: [boas práticas](04-boas-praticas.md#dinheiro), [testes](07-testes.md).

**29. "Líquido" que não é líquido**
- Sintoma: valor mostrado ao cliente ignora a tarifa do provedor; franquia gratuita anunciada não vale para cobranças via API.
- Regra: tarifa real confirmada pelo dono do negócio (não pela página de marketing); taxas calculadas e **gravadas na criação** do registro.
- Onde: [domínio](11-dominio.md).

**30. Webhook confiável**
- Padrão que funciona: rota magra (autentica, deduplica por id do evento, enfileira, responde rápido); processamento reconsulta o provedor e ignora valor do corpo; reconciliação periódica para webhook perdido.
- Onde: [backend](05-backend-api.md#webhooks).

**31. Rede dentro de transação**
- Padrão que funciona: `for update` na linha disputada numa transação curta; chamada ao provedor depois do `commit`, com compensação se falhar.

**32. Envio em massa precisa de freio**
- Sintoma: risco de bloqueio do número/remetente pelo gateway de mensageria.
- Regra: intervalo mínimo, limite por hora, kill switch por env, opt-out, e base legal LGPD decidida antes de contatar quem não pediu.
- Onde: [segurança](03-seguranca.md), [domínio](11-dominio.md).

## Front e mobile

**33. Uma string longa derruba o layout mobile**
- Sintoma: Chrome mobile reduz o zoom da página inteira.
- Causa: um código copia-e-cola (ou URL, token) numa linha só alarga uma coluna `1fr`.
- Regra: `minmax(0, 1fr)`, `min-width: 0`, quebra/truncamento, fonte ≥ 12px, alvos ≥ 44px, verificação em 320–414px.
- Onde: [frontend](06-frontend.md#regra-mobile-obrigatória).

**34. Cores literais impedem tema**
- Sintoma: tema escuro exige auditar e tokenizar dezenas de cores antes de começar.
- Regra: só tokens; tema aplicado antes do primeiro paint.
- Onde: [frontend](06-frontend.md#design-tokens-e-tema).

**35. Matriz de permissão duplicada**
- Sintoma: liberar uma ação para um papel exige mexer no back e no front, e eles divergem.
- Regra: matriz única em `@app/shared`.

**36. Parâmetro interno exposto e preview de link**
- Sintomas: regra interna (valor mínimo técnico) aparece na página pública; preview de link em app de mensagem sem imagem.
- Causas: UI exibe constraint técnica; SPA serve meta tags genéricas, e redirect por script inline é bloqueado pela CSP.
- Regra: UI pública mostra só regra de negócio; páginas compartilháveis precisam de meta tags renderizadas no servidor `[se houver]`.

**37. Tela monolítica**
- Sintoma: tela de admin com 1.000+ linhas; cada ajuste exige ler tudo (caro para humano e para agente).
- Regra: página por área, componentes extraídos, CSS por área.

## Processo com IA

**38. Contexto estourado**
- Sintoma: sessão principal lenta, cara e esquecendo decisões.
- Regra: conversa principal guarda spec, decisão e relatório; exploração, implementação e testes longos vão para subagente em background com prompt autocontido.
- Onde: [workflow Claude](10-workflow-claude.md).

**39. Agente expandindo escopo**
- Regra: toda spec tem "Fora de escopo" explícito (ex.: "não renomear infra interna", "não mexer em domínio"); revisor rejeita diff fora dele.

**40. Spec vaga**
- Regra: spec cita `arquivo:linha` e nomes reais de função; o agente que implementa não redescobre o que o autor já achou.

**41. Decisão de negócio por suposição**
- Sintoma: spec reescrita várias vezes quando chega a tarifa real; decisões de LGPD (base legal, retenção) ficam pendentes no fim.
- Regra: valor, fornecedor, custo, apagar dado, base legal → perguntar antes de escrever. Na spec, `DECIDIR:` com opções. Spec é atualizada, não descartada, quando a informação muda.

**42. Agente com hábito genérico em vez da regra do projeto**
- Sintoma: agente tenta subir Postgres local em Docker ou apontar para outro banco "por hábito".
- Regra: o prompt do agente repete o ambiente certo (`dev`, nunca `prod`) e o que é proibido.

**43. Gotchas de dev local**
- Sintoma: `EADDRINUSE` recorrente; `tsx watch` deixa processo órfão.
- Regra: liberar a porta antes de subir (`lsof -ti:<porta> -sTCP:LISTEN | xargs kill`) e preferir `tsx --env-file=... src/index.ts` sem watch em sessões de agente.

**44. "Funcionou" sem prova**
- Regra: relatório de agente traz valores reais observados (status, ids, números) e confirma que nada foi commitado; screenshots são abertos pelo revisor antes de aprovar; notificação duplicada de agente não é trabalho novo.

**45. Construir o que já existe**
- Sintoma: ferramenta interna construída e depois revertida por ser redundante com algo já em uso.
- Regra: antes de spec de ferramenta interna, perguntar "já existe algo que faz isso?".

## Checklist ao começar uma spec

- [ ] Esta mudança toca alguma lição acima? Cite o número na spec.
- [ ] Ambiente de teste é `dev` e há trava?
- [ ] Há decisão de negócio a perguntar em vez de supor?
- [ ] "Fora de escopo" escrito?

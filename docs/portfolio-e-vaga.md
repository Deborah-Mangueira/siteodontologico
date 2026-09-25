# Como relacionar este projeto à vaga

## O que foi confirmado

A página da [IAplicada](https://manager.iaplicada.com/vaga/especialista-no-code-junior-backend-auto-i221je) identifica a vaga como **Especialista No-Code Junior (Backend + Automações)** e informa que quer entender como a candidata pensa e o que já construiu. Ao iniciar, exige nome. As etapas seguintes não foram preenchidas para investigar requisitos.

No anúncio fornecido pela candidata, a empresa pede links que abram, projetos acessíveis e descrições específicas do que foi feito com Supabase, n8n, Lovable etc. A promessa de retorno em 24 horas pertence ao anúncio; não é uma garantia independente.

Não foram confirmados salário, jornada, regime, senioridade prática exigida, lista completa de ferramentas, responsabilidades internas ou critérios de aprovação. As tarefas abaixo são inferências pelo foco da vaga.

## Trabalho provável

1. Entender um processo: quem envia os dados, quem os utiliza e o que deve acontecer depois.
2. Modelar tabelas e relacionamentos: contatos, solicitações, status, usuários, eventos.
3. Configurar autenticação e permissões para impedir acesso indevido.
4. Conectar interfaces a APIs; entender JSON, métodos HTTP, autenticação e erros.
5. Montar automações por webhook ou horário no n8n, com condições e tratamento de falhas.
6. Testar o fluxo inteiro, acompanhar execuções, corrigir integrações e documentar a entrega.

Exemplo de demanda: “Quando uma pessoa pedir avaliação, registre o contato, avise a equipe e mantenha o acompanhamento atualizado”. Você precisaria transformar a frase em campos, regras, integrações e testes. No-code reduz a quantidade de código manual, mas continua exigindo lógica, segurança e diagnóstico.

## Por que evoluir a landing page

A landing page demonstra composição visual e frontend. O backend acrescenta evidências de persistência, regras de negócio, controle de acesso e integração. O recrutador deve conseguir entender o problema e experimentar o resultado sem instalar nada.

Este projeto usa código Node.js na API, portanto é mais precisamente um projeto **low-code/full-stack com integração no-code**. Ele não prova experiência com Lovable, nem experiência de produção com Supabase ou n8n antes de você realmente configurar e operar essas ferramentas.

## Roteiro de demonstração, em 3 a 5 minutos

1. Abra o tour público e explique o problema: o site tinha apresentação, mas não registrava solicitações.
2. Com o backend configurado, envie dados fictícios pelo formulário. Mostre o protocolo.
3. Entre no painel sem expor a senha. Localize o registro e altere para “Em contato”.
4. Abra o histórico: explique que a mudança foi salva com data e status.
5. Mostre uma execução no n8n somente depois de conectar e validar a integração.
6. Explique um caso de falha: o webhook pode estar fora do ar, mas a solicitação e o evento ficam salvos.
7. Cite um limite real: preferência de data não é reserva de horário; o agendamento depende da equipe.

## O que estudar no próprio código

| Conceito | Onde aparece | Como explicar |
|---|---|---|
| Frontend/backend | `app/booking.js` e `api/leads.js` | O navegador pede; o servidor valida e grava |
| Banco relacional | `supabase/migrations/001_clinic.sql` | Solicitações têm eventos relacionados por ID |
| Transação | Criação no banco | Registro e evento são salvos juntos ou nenhum é salvo |
| Idempotência | `Idempotency-Key` | Repetir o mesmo envio não duplica o pedido |
| Autorização | `requireAdmin` | Abrir o HTML do painel não dá acesso ao banco |
| Concorrência | Campo `version` | Uma alteração antiga não sobrescreve outra mais nova |
| Webhook | `server/automation.js` | O servidor notifica o n8n sobre um evento |
| Reprocessamento | Outbox | Falhas podem ser tentadas novamente sem perder o registro |

## Como descrever na candidatura

Adapte somente após fazer e entender os passos mencionados:

> “Evoluí um site institucional para um fluxo de solicitações com formulário, API, banco persistente e painel protegido. Trabalhei com validação, prevenção de duplicatas, histórico de status e eventos para integração. O desenvolvimento contou com assistência de IA; revisei e testei [descreva aqui o que você realmente revisou/testou].”

Acrescente “configurei Supabase” e “montei/executei workflow no n8n” apenas depois de executar essas etapas. Se ainda estiverem pendentes, diga que a integração está preparada no código, aguardando configuração. Não use o tour ilustrativo como prova de gravação real no banco.

Prepare respostas para: “O que acontece se o usuário clicar duas vezes?”, “Quem pode ver os contatos?”, “Onde ficam as senhas?”, “O que acontece se o n8n falhar?”, “Como você descobriu e corrigiu um erro?”. Entender essas respostas vale mais que acumular nomes de ferramentas no formulário.

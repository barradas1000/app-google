# Tuktuk Milfontes - Rastreamento de Localização

Este documento descreve a arquitetura e as funcionalidades da aplicação de rastreamento de localização em tempo real para os condutores da Tuktuk Milfontes.

## Descrição do Projeto

O objetivo é criar uma aplicação web robusta (Progressive Web App - PWA) que permita aos condutores partilhar a sua localização em tempo real. A localização é enviada para uma base de dados Supabase, permitindo que a posição dos tuk-tuks disponíveis seja consultada por outras aplicações (por exemplo, um mapa para clientes).

---

## Funcionalidades Principais

-   **Autenticação Simplificada:** Sistema de login e logout com **nome** e senha. O nome é convertido internamente para um formato de e-mail padrão (`nome.sobrenome@tuktukmilfontes.local`) para se integrar de forma segura com o Supabase Auth.
-   **Rastreamento Contínuo:** Utiliza a API de Geolocalização do navegador com alta precisão (`watchPosition`) para obter atualizações contínuas da localização do condutor.
-   **Visualização em Mapa em Tempo Real:** Um mapa interativo exibe a localização atual do condutor, com um ícone de tuk-tuk que se move em tempo real.
-   **Sincronização em Tempo Real:** A cada nova coordenada recebida, os dados são enviados para a base de dados Supabase, atualizando a latitude, longitude, precisão e o último ping do condutor.
-   **Feedback Visual Avançado:** A interface fornece um indicador de status claro para o GPS:
    -   ⚪ **Inativo (`location_off`):** O rastreamento está desligado.
    -   🟠 **A solicitar (`gps_not_fixed`):** A aplicação está a tentar obter a primeira localização.
    -   🟢 **Ativo (`location_on`):** Rastreamento a funcionar e a sincronizar com sucesso (ícone animado).
    -   🟠 **Erro de Sincronização (`sync_problem`):** A localização foi obtida, mas houve uma falha de rede ao enviar para o servidor. A aplicação tentará reenviar automaticamente.
    -   🔴 **Erro (`location_disabled`):** Ocorreu um erro, como a negação da permissão de localização.
-   **Tratamento de Erros Robusto:** A aplicação foi desenhada para ser resiliente e informar o utilizador sobre problemas:
    -   **Login Inválido:** Exibe um alerta claro de "Nome ou senha inválidos."
    -   **Permissão Negada:** Mostra um alerta informativo que explica a necessidade da permissão e guia o utilizador para as configurações do dispositivo.
    -   **Falha de Rede:** O status visual muda para "Erro de Sincronização", informando o condutor sem interromper o rastreamento.
-   **Gestão de Sessão:** Regista automaticamente o início e o fim da sessão de trabalho do condutor na base de dados.

---

## Arquitetura e Estrutura de Ficheiros

-   **Frontend:**
    -   **Tecnologias:** HTML5, CSS3 e TypeScript.
    -   **Build Tool:** [Vite](https://vitejs.dev/) para compilar o TypeScript e otimizar os assets.
    -   **Bibliotecas:** [Leaflet.js](https://leafletjs.com/) para o mapa interativo.
    -   **APIs:** `Geolocation API` nativa do navegador para obter as coordenadas GPS.
    -   **Funcionalidade Offline:** Desenhada como um PWA com um Service Worker básico.

-   **Backend (BaaS - Backend as a Service):**
    -   **Platforma:** [Supabase](https://supabase.io/)
    -   **Base de Dados:** Supabase Postgres.
    -   **Autenticação:** Supabase Auth.

-   **Estrutura de Ficheiros (Vite):**
    ```
    /
    ├── public/
    │   ├── manifest.json
    │   └── sw.js
    ├── src/
    │   ├── index.css
    │   └── index.tsx
    ├── .env.example
    ├── index.html
    ├── package.json
    └── tsconfig.json
    ```
    -   `src/`: Contém todo o código fonte da aplicação (TypeScript e CSS).
    -   `public/`: Contém os ficheiros estáticos que são copiados para a pasta de build sem processamento.
    -   `index.html`: O ponto de entrada da aplicação.

---

## Build e Deploy com Vite e Vercel

Este projeto usa o Vite como ferramenta de build.

### Desenvolvimento Local

1.  **Crie um ficheiro `.env`** na raiz do projeto, copiando o conteúdo de `.env.example`. Preencha com as suas credenciais do Supabase.
2.  **Instale as dependências:**
    ```bash
    npm install
    ```
3.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

### Deploy na Vercel

1.  **Envie o seu código** para um repositório no GitHub.
2.  **Crie uma conta na Vercel** e importe o seu repositório. A Vercel detetará automaticamente que é um projeto Vite.
3.  **Configure as Variáveis de Ambiente** no painel de controlo do seu projeto na Vercel:
    -   `VITE_SUPABASE_URL`: A URL do seu projeto Supabase.
    -   `VITE_SUPABASE_ANON_KEY`: A chave pública (anon) do seu projeto Supabase.
4.  **Faça o deploy!** A Vercel executará o comando `npm run build` e publicará o resultado.

---

## Plano de Construção (Concluído)

O desenvolvimento passou pelas seguintes etapas, todas concluídas com sucesso.

### Etapa 1: UI Básica e Estrutura do Projeto
-   [X] **(Feito)** Criar o ficheiro `index.html` com a estrutura base.
-   [X] **(Feito)** Criar o ficheiro `index.css` para estilos visuais mínimos e responsivos.
-   [X] **(Feito)** Adicionar botões "Iniciar Sessão" e "Terminar Sessão".
-   [X] **(Feito)** Adicionar uma área no ecrã para exibir o status da conexão, as coordenadas atuais e mensagens de erro.

### Etapa 2: Geolocalização
-   [X] **(Feito)** Implementar a lógica em `index.tsx` para solicitar permissão de acesso à localização.
-   [X] **(Feito)** Utilizar `navigator.geolocation.watchPosition` para receber atualizações contínuas de localização.
-   [X] **(Feito)** Exibir a latitude, longitude e precisão (accuracy) na UI.
-   [X] **(Feito)** Lidar com casos em que a permissão é negada pelo usuário.

### Etapa 3: Integração com Supabase e PWA
-   [X] **(Feito)** Adicionar a biblioteca `@supabase/supabase-js` ao projeto via `package.json`.
-   [X] **(Feito)** Configurar o cliente Supabase com as credenciais do projeto.
-   [X] **(Feito)** Implementar o sistema de login/logout com nome/senha via Supabase Auth.
-   [X] **(Feito)** Adicionar `manifest.json` para transformar a app numa PWA.
-   [X] **(Feito)** Adicionar `sw.js` (Service Worker) para funcionalidade offline básica.

### Etapa 4: Sincronização de Dados
-   [X] **(Feito)** Ao fazer login, criar/atualizar um registo na tabela `active_conductors` com o estado `is_active = true` e a hora de início.
-   [X] **(Feito)** A cada atualização de localização recebida do `watchPosition`, enviar as novas coordenadas (`current_latitude`, `current_longitude`, `accuracy`, `last_ping`) para a linha correspondente do condutor no Supabase.
-   [X] **(Feito)** Ao fazer logout, atualizar o registo com `is_active = false` e a hora de fim (`session_end`).

### Etapa 5: Refinamentos e Testes
-   [X] **(Feito)** Melhorar a UI/UX, adicionando feedback visual para o estado do rastreamento.
-   [X] **(Feito)** Implementar tratamento de erros robusto (falha de rede, erros da API Supabase, etc.).
-   [X] **(Feito)** Testar a aplicação em diferentes dispositivos e condições de rede.

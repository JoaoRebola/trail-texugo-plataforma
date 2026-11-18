# Plataforma de gestão — Trail do Texugo

Página simples (HTML/JS, sem servidor próprio) para a organização gerir a app.
Instala-se no telemóvel como uma app: abrir no Chrome → menu ⋮ → **Adicionar ao ecrã principal**.

## Pôr online (grátis)
A câmara (para ler os QR na receção) só funciona num endereço `https://`. A forma mais simples:

1. Criar um repositório no GitHub, por exemplo `trail-texugo-plataforma`.
2. Copiar para lá **o conteúdo desta pasta** (com o `config.js` já preenchido).
3. No repositório: **Settings → Pages → Branch: main → Save**.
4. Passado um minuto fica em `https://<o-teu-utilizador>.github.io/trail-texugo-plataforma/`.

Para experimentar no PC sem pôr online:
```powershell
python -m http.server 8766 --directory Plataforma
```
e abrir http://localhost:8766 (a câmara funciona em `localhost`).

## O que se pode fazer
| Botão | Para quê |
|---|---|
| 📢 Escrever comunicado | Aviso na app com notificação. Modelos prontos, imagem, agendamento, pré-visualização "Assim fica na app". |
| ✅ Aprovar | Outro gestor aprova antes de chegar aos telemóveis. |
| 🎫 Receção de atletas | Ler o QR do atleta (ou escrever o dorsal) e entregar dorsal/kit. Verde = entregar; amarelo = já levantado; vermelho = erro. Som e vibração. |
| ⛰️ Posto de controlo | No dia: registar passagens, chegadas e abandonos por dorsal. A família vê na app em "Seguir atletas". |
| 🆘 Pedidos de ajuda | SOS enviados pela app, com localização no mapa. Atualiza sozinho e apita. |
| 👟 Inscritos | Importar a lista da Stop&Go (CSV), procurar, exportar, ver quantos já levantaram. |
| 🗓️ Edição da prova | Data, estado das inscrições (quando passa a "Abertas", os telemóveis recebem notificação), ligações, percursos, programa, telefone de emergência. |
| 🏁 Resultados | Importar classificações (CSV). Os atletas veem na app e geram o diploma. |
| 📸 Fotografias | Carregar fotos e marcar dorsais. Os atletas procuram-se pelo dorsal. |
| 🤝 Voluntários | Postos, turnos e contactos; exportar. |
| ⭐ Parceiros | Logótipos que aparecem no Início da app. |
| 💬 Opinião dos atletas | Respostas ao inquérito pós-prova. |
| 🧾 Registo de atividade | Quem fez o quê e quando. |
| 🔑 Gestores | Só administradores: dar e retirar acessos. Papéis: Administrador, Gestor, Receção/postos. |

## Dia da prova — sugestão
- 2–3 telemóveis em **Receção** no secretariado (todos ao mesmo tempo, sem duplicar).
- Um telemóvel por posto em **Posto de controlo** (o nome do posto fica guardado no telemóvel).
- Alguém com **Pedidos de ajuda** aberto o tempo todo.
- Comunicados **urgentes** (meteorologia, alterações) chegam aos telemóveis no máximo em 30 minutos.

# INOVACAR Gestão

Uma página para gerir a oficina: os carros que estão lá dentro, os clientes e quanto tempo demora cada carro.
A Google Sheet **INOVACAR Pontos** é a base de dados. A página não tem servidor próprio: fala com a sheet por um
Apps Script.

Fica à parte do resto do repositório: HTML, CSS e JavaScript simples, sem build. Para a usar basta servir esta
pasta (GitHub Pages, ou abrir com qualquer servidor estático).

## O que faz

- **Oficina**: o quadro dos carros que estão na oficina, em três colunas: À espera, Em trabalho, Pronto a levantar.
  Cada cartão diz há quanto tempo, a quem é e se passou o dia prometido. Um botão leva o carro ao passo seguinte
  (Começar, Marcar pronto, Entregar) e grava a hora.
- **Dar entrada**: escreve-se a matrícula. Se o carro já existe, aparece com o dono; se é novo, pede a marca e o
  cliente (e sugere clientes que já existam enquanto se escreve o nome ou o telemóvel).
- **Clientes** e **Carros**: listas com pesquisa, a ficha de cada um e o histórico de visitas.
- **Tempos**: quanto tempo os carros ficam na oficina e quanto tempo levam a ser feitos, por serviço, e quantos
  ficaram prontos no dia prometido. Os tempos contam só as horas de abertura (seg a sex, 09:00 às 18:30;
  muda-se em `config.js`).

Se a ligação falhar, as alterações ficam guardadas no aparelho e seguem para a sheet quando ela voltar.

## A sheet

O script cria três abas novas na primeira vez que é usado e só escreve nelas. A aba **Pontos** e o script dos
pontos do site ficam como estão.

| Aba | Colunas |
| --- | --- |
| Gestão Clientes | id, nome, telemovel, email, nif, notas, criado_em |
| Gestão Carros | id, cliente_id, matricula, marca, modelo, ano, km, notas, criado_em |
| Gestão Trabalhos | id, carro_id, servico, descricao, estado, entrada, inicio, pronto, entregue, previsto, notas, criado_em |

As datas ficam legíveis (`2026-11-08 09:12`). `estado` é `espera`, `curso`, `pronto` ou `entregue`.
Pode acrescentar colunas suas no fim de cada aba: a página ignora-as e não as estraga.

## Ligar à sheet (uma vez)

1. Em [script.google.com](https://script.google.com/home/projects/create), crie um projeto novo
   (por exemplo "INOVACAR Gestão") e cole o conteúdo de `apps-script/Codigo.gs`.
2. No topo do ficheiro, troque `mude-este-pin` por um PIN seu (é o que a equipa vai escrever na página).
3. **Implementar > Nova implementação > Aplicação Web**. Executar como: **Eu**. Quem tem acesso: **Qualquer pessoa**.
4. Autorize o acesso à sheet e copie o URL que acaba em `/exec`.
5. Na página, carregue na engrenagem, cole o URL e o PIN e carregue em **Testar e ligar**.

Para não ter de colar o URL em cada aparelho, ponha-o em `config.js` (`apiUrl`). O PIN nunca vai para o
repositório: cada aparelho escreve-o uma vez e fica guardado nesse aparelho.

Se mudar o código do script mais tarde: **Implementar > Gerir implementações > Editar > Nova versão**, para o
mesmo URL continuar a funcionar.

## Sem ligação

Sem URL a página abre em **modo de demonstração**, com dados de exemplo guardados só no navegador, para
experimentar antes de ligar.

## Ficheiros

- `index.html`, `app.css`, `app.js`: a página.
- `config.js`: o URL do script, o horário e a lista de serviços (os mesmos do site).
- `icones.js`: ícones Phosphor (MIT).
- `assets/`: o logo e o favicon do site da INOVACAR, e as letras Barlow (SIL Open Font License, `fonts/OFL.txt`).
- `apps-script/Codigo.gs`: a ponte para a Google Sheet.

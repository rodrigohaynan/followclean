# FollowClean

FollowClean analisa relacionamentos do Instagram a partir dos dados exportados pelo próprio usuário, aplica regras de limpeza e prepara uma fila assistida de revisão/unfollow.

## MVP atual

1. Importar o arquivo oficial exportado pelo Instagram.
2. Identificar seguidores, seguindo, recíprocos e quem não segue de volta.
3. Salvar snapshots localmente no navegador com IndexedDB.
4. Comparar importações para mostrar novos seguidores e quem deixou de seguir.
5. Manter uma lista local de perfis protegidos.
6. Aplicar a regra “não segue de volta + não está protegido = candidato à limpeza”.
7. Montar uma fila de revisão com busca e acesso ao perfil no Instagram.
8. Extensão Chrome com verificação contínua, pausa automática em checkpoint e retomada após reinício.
9. Checkpoint opcional em Postgres externo para continuar a fila em outro computador.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- IndexedDB no navegador
- Neon/Postgres para checkpoint em nuvem
- Netlify
- Extensão Chrome FollowClean Assist

O modo local continua funcionando sem banco externo. Quando a sincronização em nuvem é configurada, o FollowClean usa Postgres apenas para fila, checkpoints e resultados de verificação. O sistema não solicita a senha do Instagram e não tenta contornar limitações, bloqueios ou mecanismos antiabuso da plataforma. Se o Instagram exibir login, checkpoint ou bloqueio, a execução é pausada.

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
8. Evoluir depois para regras adicionais e extensão Chrome vinculada ao painel.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- IndexedDB no navegador
- Netlify
- Extensão Chrome (fase posterior)

O MVP atual não depende de banco externo. O sistema não solicita a senha do Instagram e não tenta contornar limitações, bloqueios ou mecanismos antiabuso da plataforma. A fila é assistida: o usuário continua responsável por cada ação realizada no Instagram.

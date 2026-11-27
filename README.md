# FollowClean

FollowClean analisa relacionamentos do Instagram a partir dos dados exportados pelo próprio usuário, aplica regras de limpeza e prepara uma fila assistida de revisão/unfollow.

## Funcionalidades

1. Importar o arquivo oficial exportado pelo Instagram (JSON ou HTML).
2. Identificar seguidores, seguindo, recíprocos e quem não segue de volta.
3. Salvar snapshots localmente no navegador com IndexedDB, separados por conta.
4. Comparar importações para mostrar novos seguidores e quem deixou de seguir.
5. Manter uma lista local de perfis protegidos.
6. Aplicar a regra “não segue de volta + não está protegido = candidato à limpeza”, com limite de seguidores.
7. Montar uma fila de revisão com busca, filtro por inicial e acesso ao perfil no Instagram.
8. Extensão Chrome com verificação contínua, pausa automática em checkpoint e retomada após reinício.
9. App Android com scanner nativo e backup em arquivo.
10. Checkpoint opcional em Postgres (Neon) para continuar a fila em outro computador.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- IndexedDB no navegador
- Neon/Postgres para checkpoint em nuvem (opcional)
- Netlify
- Extensão Chrome FollowClean Assist e app Android (WebView)

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `FOLLOWCLEAN_SESSION_SECRET` | Segredo para criptografar a sessão e assinar estados do OAuth. |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | App da Meta (Instagram Login). |
| `INSTAGRAM_REDIRECT_URI` | `https://followclean.netlify.app/api/instagram/callback` |
| `FOLLOWCLEAN_DATABASE_URL` | String de conexão do Neon. Sem ela, o checkpoint em nuvem fica desativado. |
| `FOLLOWCLEAN_CLOUD_SECRET` | Opcional: segredo dedicado para os tokens da nuvem. |

O modo local continua funcionando sem banco externo. Quando a sincronização em nuvem é configurada, o FollowClean usa Postgres apenas para fila, checkpoints e resultados de verificação. O sistema não solicita a senha do Instagram e não tenta contornar limitações, bloqueios ou mecanismos antiabuso da plataforma. Se o Instagram exibir login, checkpoint ou bloqueio, a execução é pausada.

## App Android

O workflow **Build FollowClean Android APK** gera o APK assinado e, na branch `main`, publica o arquivo no release `android-latest`. A página `/instalar` aponta para `releases/latest/download/FollowClean.apk`.

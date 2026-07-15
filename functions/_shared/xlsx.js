/*
 * Minimal Accrivia XLSX generator for Cloudflare Pages Functions.
 *
 * The package skeleton is derived from:
 * reference/Accrivia_Skeleton.xlsx
 *
 * The generated workbook has:
 * A = Stock Code
 * B = Description
 * C = Quan
 * D = Rate Ex
 *
 * Rate Ex is intentionally blank.
 */

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const STATIC_XLSX_ENTRIES = [
  { name: "[Content_Types].xml", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPjxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1wYWNrYWdlLnJlbGF0aW9uc2hpcHMreG1sIi8+PERlZmF1bHQgRXh0ZW5zaW9uPSJ4bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi94bWwiLz48T3ZlcnJpZGUgUGFydE5hbWU9Ii94bC93b3JrYm9vay54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldC5tYWluK3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3hsL3dvcmtzaGVldHMvc2hlZXQxLnhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC5zcHJlYWRzaGVldG1sLndvcmtzaGVldCt4bWwiLz48T3ZlcnJpZGUgUGFydE5hbWU9Ii94bC90aGVtZS90aGVtZTEueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnRoZW1lK3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL3hsL3N0eWxlcy54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zdHlsZXMreG1sIi8+PE92ZXJyaWRlIFBhcnROYW1lPSIveGwvc2hhcmVkU3RyaW5ncy54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGFyZWRTdHJpbmdzK3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL2RvY1Byb3BzL2NvcmUueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLXBhY2thZ2UuY29yZS1wcm9wZXJ0aWVzK3htbCIvPjxPdmVycmlkZSBQYXJ0TmFtZT0iL2RvY1Byb3BzL2FwcC54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuZXh0ZW5kZWQtcHJvcGVydGllcyt4bWwiLz48L1R5cGVzPg==" },
  { name: "_rels/.rels", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+PFJlbGF0aW9uc2hpcCBJZD0icklkMyIgVHlwZT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9leHRlbmRlZC1wcm9wZXJ0aWVzIiBUYXJnZXQ9ImRvY1Byb3BzL2FwcC54bWwiLz48UmVsYXRpb25zaGlwIElkPSJySWQyIiBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMvbWV0YWRhdGEvY29yZS1wcm9wZXJ0aWVzIiBUYXJnZXQ9ImRvY1Byb3BzL2NvcmUueG1sIi8+PFJlbGF0aW9uc2hpcCBJZD0icklkMSIgVHlwZT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9vZmZpY2VEb2N1bWVudCIgVGFyZ2V0PSJ4bC93b3JrYm9vay54bWwiLz48L1JlbGF0aW9uc2hpcHM+" },
  { name: "xl/workbook.xml", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPHdvcmtib29rIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvc3ByZWFkc2hlZXRtbC8yMDA2L21haW4iIHhtbG5zOnI9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMiIHhtbG5zOm1jPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvbWFya3VwLWNvbXBhdGliaWxpdHkvMjAwNiIgbWM6SWdub3JhYmxlPSJ4MTUgeHIgeHI2IHhyMTAgeHIyIiB4bWxuczp4MTU9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3NwcmVhZHNoZWV0bWwvMjAxMC8xMS9tYWluIiB4bWxuczp4cj0iaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS9vZmZpY2Uvc3ByZWFkc2hlZXRtbC8yMDE0L3JldmlzaW9uIiB4bWxuczp4cjY9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3NwcmVhZHNoZWV0bWwvMjAxNi9yZXZpc2lvbjYiIHhtbG5zOnhyMTA9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3NwcmVhZHNoZWV0bWwvMjAxNi9yZXZpc2lvbjEwIiB4bWxuczp4cjI9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3NwcmVhZHNoZWV0bWwvMjAxNS9yZXZpc2lvbjIiPjxmaWxlVmVyc2lvbiBhcHBOYW1lPSJ4bCIgbGFzdEVkaXRlZD0iNyIgbG93ZXN0RWRpdGVkPSI3IiBydXBCdWlsZD0iMzAxMzEiLz48d29ya2Jvb2tQciBkZWZhdWx0VGhlbWVWZXJzaW9uPSIyMDIzMDAiLz48bWM6QWx0ZXJuYXRlQ29udGVudCB4bWxuczptYz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL21hcmt1cC1jb21wYXRpYmlsaXR5LzIwMDYiPjxtYzpDaG9pY2UgUmVxdWlyZXM9IngxNSI+PHgxNWFjOmFic1BhdGggdXJsPSJDOlxVc2Vyc1xtYXJrZXRpbmdcRGVza3RvcFwiIHhtbG5zOngxNWFjPSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS9zcHJlYWRzaGVldG1sLzIwMTAvMTEvYWMiLz48L21jOkNob2ljZT48L21jOkFsdGVybmF0ZUNvbnRlbnQ+PHhyOnJldmlzaW9uUHRyIHJldklETGFzdFNhdmU9IjAiIGRvY3VtZW50SWQ9Ijhfe0FCQzEwMUFDLTQyRTYtNEM2Qy1CREY4LTI3NkUzMjlGMDJCOH0iIHhyNjpjb2F1dGhWZXJzaW9uTGFzdD0iNDciIHhyNjpjb2F1dGhWZXJzaW9uTWF4PSI0NyIgeHIxMDp1aWRMYXN0U2F2ZT0iezAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMH0iLz48Ym9va1ZpZXdzPjx3b3JrYm9va1ZpZXcgeFdpbmRvdz0iLTEyMCIgeVdpbmRvdz0iLTEyMCIgd2luZG93V2lkdGg9IjI5MDQwIiB3aW5kb3dIZWlnaHQ9IjE1NzIwIiB4cjI6dWlkPSJ7NzBCMTQ4NTAtQkYwOC00QjU3LUFBODAtNUM5NDA1Q0ZBODE4fSIvPjwvYm9va1ZpZXdzPjxzaGVldHM+PHNoZWV0IG5hbWU9IlNoZWV0MSIgc2hlZXRJZD0iMSIgcjppZD0icklkMSIvPjwvc2hlZXRzPjxjYWxjUHIgY2FsY0lkPSIxOTEwMjkiLz48ZXh0THN0PjxleHQgdXJpPSJ7MTQwQTcwOTQtMEUzNS00ODkyLTg0MzItQzREMkU1N0VERUI1fSIgeG1sbnM6eDE1PSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS9zcHJlYWRzaGVldG1sLzIwMTAvMTEvbWFpbiI+PHgxNTp3b3JrYm9va1ByIGNoYXJ0VHJhY2tpbmdSZWZCYXNlPSIxIi8+PC9leHQ+PGV4dCB1cmk9IntCNThCMDM5Mi00RjFGLTQxOTAtQkI2NC01REYzNTcxRENFNUZ9IiB4bWxuczp4Y2FsY2Y9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3NwcmVhZHNoZWV0bWwvMjAxOC9jYWxjZmVhdHVyZXMiPjx4Y2FsY2Y6Y2FsY0ZlYXR1cmVzPjx4Y2FsY2Y6ZmVhdHVyZSBuYW1lPSJtaWNyb3NvZnQuY29tOlJEIi8+PHhjYWxjZjpmZWF0dXJlIG5hbWU9Im1pY3Jvc29mdC5jb206U2luZ2xlIi8+PHhjYWxjZjpmZWF0dXJlIG5hbWU9Im1pY3Jvc29mdC5jb206RlYiLz48eGNhbGNmOmZlYXR1cmUgbmFtZT0ibWljcm9zb2Z0LmNvbTpDTk1UTSIvPjx4Y2FsY2Y6ZmVhdHVyZSBuYW1lPSJtaWNyb3NvZnQuY29tOkxFVF9XRiIvPjx4Y2FsY2Y6ZmVhdHVyZSBuYW1lPSJtaWNyb3NvZnQuY29tOkxBTUJEQV9XRiIvPjx4Y2FsY2Y6ZmVhdHVyZSBuYW1lPSJtaWNyb3NvZnQuY29tOkFSUkFZVEVYVF9XRiIvPjwveGNhbGNmOmNhbGNGZWF0dXJlcz48L2V4dD48L2V4dExzdD48L3dvcmtib29rPg==" },
  { name: "xl/_rels/workbook.xml.rels", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+PFJlbGF0aW9uc2hpcCBJZD0icklkMyIgVHlwZT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9zdHlsZXMiIFRhcmdldD0ic3R5bGVzLnhtbCIvPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDIiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvdGhlbWUiIFRhcmdldD0idGhlbWUvdGhlbWUxLnhtbCIvPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvd29ya3NoZWV0IiBUYXJnZXQ9IndvcmtzaGVldHMvc2hlZXQxLnhtbCIvPjxSZWxhdGlvbnNoaXAgSWQ9InJJZDQiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvc2hhcmVkU3RyaW5ncyIgVGFyZ2V0PSJzaGFyZWRTdHJpbmdzLnhtbCIvPjwvUmVsYXRpb25zaGlwcz4=" },
  { name: "xl/theme/theme1.xml", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPGE6dGhlbWUgeG1sbnM6YT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL2RyYXdpbmdtbC8yMDA2L21haW4iIG5hbWU9Ik9mZmljZSBUaGVtZSI+PGE6dGhlbWVFbGVtZW50cz48YTpjbHJTY2hlbWUgbmFtZT0iT2ZmaWNlIj48YTpkazE+PGE6c3lzQ2xyIHZhbD0id2luZG93VGV4dCIgbGFzdENscj0iMDAwMDAwIi8+PC9hOmRrMT48YTpsdDE+PGE6c3lzQ2xyIHZhbD0id2luZG93IiBsYXN0Q2xyPSJGRkZGRkYiLz48L2E6bHQxPjxhOmRrMj48YTpzcmdiQ2xyIHZhbD0iMEUyODQxIi8+PC9hOmRrMj48YTpsdDI+PGE6c3JnYkNsciB2YWw9IkU4RThFOCIvPjwvYTpsdDI+PGE6YWNjZW50MT48YTpzcmdiQ2xyIHZhbD0iMTU2MDgyIi8+PC9hOmFjY2VudDE+PGE6YWNjZW50Mj48YTpzcmdiQ2xyIHZhbD0iRTk3MTMyIi8+PC9hOmFjY2VudDI+PGE6YWNjZW50Mz48YTpzcmdiQ2xyIHZhbD0iMTk2QjI0Ii8+PC9hOmFjY2VudDM+PGE6YWNjZW50ND48YTpzcmdiQ2xyIHZhbD0iMEY5RUQ1Ii8+PC9hOmFjY2VudDQ+PGE6YWNjZW50NT48YTpzcmdiQ2xyIHZhbD0iQTAyQjkzIi8+PC9hOmFjY2VudDU+PGE6YWNjZW50Nj48YTpzcmdiQ2xyIHZhbD0iNEVBNzJFIi8+PC9hOmFjY2VudDY+PGE6aGxpbms+PGE6c3JnYkNsciB2YWw9IjQ2Nzg4NiIvPjwvYTpobGluaz48YTpmb2xIbGluaz48YTpzcmdiQ2xyIHZhbD0iOTY2MDdEIi8+PC9hOmZvbEhsaW5rPjwvYTpjbHJTY2hlbWU+PGE6Zm9udFNjaGVtZSBuYW1lPSJPZmZpY2UiPjxhOm1ham9yRm9udD48YTpsYXRpbiB0eXBlZmFjZT0iQXB0b3MgRGlzcGxheSIgcGFub3NlPSIwMjExMDAwNDAyMDIwMjAyMDIwNCIvPjxhOmVhIHR5cGVmYWNlPSIiLz48YTpjcyB0eXBlZmFjZT0iIi8+PGE6Zm9udCBzY3JpcHQ9IkpwYW4iIHR5cGVmYWNlPSLmuLjjgrTjgrfjg4Pjgq8gTGlnaHQiLz48YTpmb250IHNjcmlwdD0iSGFuZyIgdHlwZWZhY2U9IuunkeydgCDqs6DrlJUiLz48YTpmb250IHNjcmlwdD0iSGFucyIgdHlwZWZhY2U9Iuetiee6vyBMaWdodCIvPjxhOmZvbnQgc2NyaXB0PSJIYW50IiB0eXBlZmFjZT0i5paw57Sw5piO6auUIi8+PGE6Zm9udCBzY3JpcHQ9IkFyYWIiIHR5cGVmYWNlPSJUaW1lcyBOZXcgUm9tYW4iLz48YTpmb250IHNjcmlwdD0iSGViciIgdHlwZWZhY2U9IlRpbWVzIE5ldyBSb21hbiIvPjxhOmZvbnQgc2NyaXB0PSJUaGFpIiB0eXBlZmFjZT0iVGFob21hIi8+PGE6Zm9udCBzY3JpcHQ9IkV0aGkiIHR5cGVmYWNlPSJOeWFsYSIvPjxhOmZvbnQgc2NyaXB0PSJCZW5nIiB0eXBlZmFjZT0iVnJpbmRhIi8+PGE6Zm9udCBzY3JpcHQ9Ikd1anIiIHR5cGVmYWNlPSJTaHJ1dGkiLz48YTpmb250IHNjcmlwdD0iS2htciIgdHlwZWZhY2U9Ik1vb2xCb3JhbiIvPjxhOmZvbnQgc2NyaXB0PSJLbmRhIiB0eXBlZmFjZT0iVHVuZ2EiLz48YTpmb250IHNjcmlwdD0iR3VydSIgdHlwZWZhY2U9IlJhYXZpIi8+PGE6Zm9udCBzY3JpcHQ9IkNhbnMiIHR5cGVmYWNlPSJFdXBoZW1pYSIvPjxhOmZvbnQgc2NyaXB0PSJDaGVyIiB0eXBlZmFjZT0iUGxhbnRhZ2VuZXQgQ2hlcm9rZWUiLz48YTpmb250IHNjcmlwdD0iWWlpaSIgdHlwZWZhY2U9Ik1pY3Jvc29mdCBZaSBCYWl0aSIvPjxhOmZvbnQgc2NyaXB0PSJUaWJ0IiB0eXBlZmFjZT0iTWljcm9zb2Z0IEhpbWFsYXlhIi8+PGE6Zm9udCBzY3JpcHQ9IlRoYWEiIHR5cGVmYWNlPSJNViBCb2xpIi8+PGE6Zm9udCBzY3JpcHQ9IkRldmEiIHR5cGVmYWNlPSJNYW5nYWwiLz48YTpmb250IHNjcmlwdD0iVGVsdSIgdHlwZWZhY2U9IkdhdXRhbWkiLz48YTpmb250IHNjcmlwdD0iVGFtbCIgdHlwZWZhY2U9IkxhdGhhIi8+PGE6Zm9udCBzY3JpcHQ9IlN5cmMiIHR5cGVmYWNlPSJFc3RyYW5nZWxvIEVkZXNzYSIvPjxhOmZvbnQgc2NyaXB0PSJPcnlhIiB0eXBlZmFjZT0iS2FsaW5nYSIvPjxhOmZvbnQgc2NyaXB0PSJNbHltIiB0eXBlZmFjZT0iS2FydGlrYSIvPjxhOmZvbnQgc2NyaXB0PSJMYW9vIiB0eXBlZmFjZT0iRG9rQ2hhbXBhIi8+PGE6Zm9udCBzY3JpcHQ9IlNpbmgiIHR5cGVmYWNlPSJJc2tvb2xhIFBvdGEiLz48YTpmb250IHNjcmlwdD0iTW9uZyIgdHlwZWZhY2U9Ik1vbmdvbGlhbiBCYWl0aSIvPjxhOmZvbnQgc2NyaXB0PSJWaWV0IiB0eXBlZmFjZT0iVGltZXMgTmV3IFJvbWFuIi8+PGE6Zm9udCBzY3JpcHQ9IlVpZ2giIHR5cGVmYWNlPSJNaWNyb3NvZnQgVWlnaHVyIi8+PGE6Zm9udCBzY3JpcHQ9Ikdlb3IiIHR5cGVmYWNlPSJTeWxmYWVuIi8+PGE6Zm9udCBzY3JpcHQ9IkFybW4iIHR5cGVmYWNlPSJBcmlhbCIvPjxhOmZvbnQgc2NyaXB0PSJCdWdpIiB0eXBlZmFjZT0iTGVlbGF3YWRlZSBVSSIvPjxhOmZvbnQgc2NyaXB0PSJCb3BvIiB0eXBlZmFjZT0iTWljcm9zb2Z0IEpoZW5nSGVpIi8+PGE6Zm9udCBzY3JpcHQ9IkphdmEiIHR5cGVmYWNlPSJKYXZhbmVzZSBUZXh0Ii8+PGE6Zm9udCBzY3JpcHQ9Ikxpc3UiIHR5cGVmYWNlPSJTZWdvZSBVSSIvPjxhOmZvbnQgc2NyaXB0PSJNeW1yIiB0eXBlZmFjZT0iTXlhbm1hciBUZXh0Ii8+PGE6Zm9udCBzY3JpcHQ9Ik5rb28iIHR5cGVmYWNlPSJFYnJpbWEiLz48YTpmb250IHNjcmlwdD0iT2xjayIgdHlwZWZhY2U9Ik5pcm1hbGEgVUkiLz48YTpmb250IHNjcmlwdD0iT3NtYSIgdHlwZWZhY2U9IkVicmltYSIvPjxhOmZvbnQgc2NyaXB0PSJQaGFnIiB0eXBlZmFjZT0iUGhhZ3NwYSIvPjxhOmZvbnQgc2NyaXB0PSJTeXJuIiB0eXBlZmFjZT0iRXN0cmFuZ2VsbyBFZGVzc2EiLz48YTpmb250IHNjcmlwdD0iU3lyaiIgdHlwZWZhY2U9IkVzdHJhbmdlbG8gRWRlc3NhIi8+PGE6Zm9udCBzY3JpcHQ9IlN5cmUiIHR5cGVmYWNlPSJFc3RyYW5nZWxvIEVkZXNzYSIvPjxhOmZvbnQgc2NyaXB0PSJTb3JhIiB0eXBlZmFjZT0iTmlybWFsYSBVSSIvPjxhOmZvbnQgc2NyaXB0PSJUYWxlIiB0eXBlZmFjZT0iTWljcm9zb2Z0IFRhaSBMZSIvPjxhOmZvbnQgc2NyaXB0PSJUYWx1IiB0eXBlZmFjZT0iTWljcm9zb2Z0IE5ldyBUYWkgTHVlIi8+PGE6Zm9udCBzY3JpcHQ9IlRmbmciIHR5cGVmYWNlPSJFYnJpbWEiLz48L2E6bWFqb3JGb250PjxhOm1pbm9yRm9udD48YTpsYXRpbiB0eXBlZmFjZT0iQXB0b3MgTmFycm93IiBwYW5vc2U9IjAyMTEwMDA0MDIwMjAyMDIwMjA0Ii8+PGE6ZWEgdHlwZWZhY2U9IiIvPjxhOmNzIHR5cGVmYWNlPSIiLz48YTpmb250IHNjcmlwdD0iSnBhbiIgdHlwZWZhY2U9Iua4uOOCtOOCt+ODg+OCryIvPjxhOmZvbnQgc2NyaXB0PSJIYW5nIiB0eXBlZmFjZT0i66eR7J2AIOqzoOuUlSIvPjxhOmZvbnQgc2NyaXB0PSJIYW5zIiB0eXBlZmFjZT0i562J57q/Ii8+PGE6Zm9udCBzY3JpcHQ9IkhhbnQiIHR5cGVmYWNlPSLmlrDntLDmmI7pq5QiLz48YTpmb250IHNjcmlwdD0iQXJhYiIgdHlwZWZhY2U9IkFyaWFsIi8+PGE6Zm9udCBzY3JpcHQ9IkhlYnIiIHR5cGVmYWNlPSJBcmlhbCIvPjxhOmZvbnQgc2NyaXB0PSJUaGFpIiB0eXBlZmFjZT0iVGFob21hIi8+PGE6Zm9udCBzY3JpcHQ9IkV0aGkiIHR5cGVmYWNlPSJOeWFsYSIvPjxhOmZvbnQgc2NyaXB0PSJCZW5nIiB0eXBlZmFjZT0iVnJpbmRhIi8+PGE6Zm9udCBzY3JpcHQ9Ikd1anIiIHR5cGVmYWNlPSJTaHJ1dGkiLz48YTpmb250IHNjcmlwdD0iS2htciIgdHlwZWZhY2U9IkRhdW5QZW5oIi8+PGE6Zm9udCBzY3JpcHQ9IktuZGEiIHR5cGVmYWNlPSJUdW5nYSIvPjxhOmZvbnQgc2NyaXB0PSJHdXJ1IiB0eXBlZmFjZT0iUmFhdmkiLz48YTpmb250IHNjcmlwdD0iQ2FucyIgdHlwZWZhY2U9IkV1cGhlbWlhIi8+PGE6Zm9udCBzY3JpcHQ9IkNoZXIiIHR5cGVmYWNlPSJQbGFudGFnZW5ldCBDaGVyb2tlZSIvPjxhOmZvbnQgc2NyaXB0PSJZaWlpIiB0eXBlZmFjZT0iTWljcm9zb2Z0IFlpIEJhaXRpIi8+PGE6Zm9udCBzY3JpcHQ9IlRpYnQiIHR5cGVmYWNlPSJNaWNyb3NvZnQgSGltYWxheWEiLz48YTpmb250IHNjcmlwdD0iVGhhYSIgdHlwZWZhY2U9Ik1WIEJvbGkiLz48YTpmb250IHNjcmlwdD0iRGV2YSIgdHlwZWZhY2U9Ik1hbmdhbCIvPjxhOmZvbnQgc2NyaXB0PSJUZWx1IiB0eXBlZmFjZT0iR2F1dGFtaSIvPjxhOmZvbnQgc2NyaXB0PSJUYW1sIiB0eXBlZmFjZT0iTGF0aGEiLz48YTpmb250IHNjcmlwdD0iU3lyYyIgdHlwZWZhY2U9IkVzdHJhbmdlbG8gRWRlc3NhIi8+PGE6Zm9udCBzY3JpcHQ9Ik9yeWEiIHR5cGVmYWNlPSJLYWxpbmdhIi8+PGE6Zm9udCBzY3JpcHQ9Ik1seW0iIHR5cGVmYWNlPSJLYXJ0aWthIi8+PGE6Zm9udCBzY3JpcHQ9Ikxhb28iIHR5cGVmYWNlPSJEb2tDaGFtcGEiLz48YTpmb250IHNjcmlwdD0iU2luaCIgdHlwZWZhY2U9Iklza29vbGEgUG90YSIvPjxhOmZvbnQgc2NyaXB0PSJNb25nIiB0eXBlZmFjZT0iTW9uZ29saWFuIEJhaXRpIi8+PGE6Zm9udCBzY3JpcHQ9IlZpZXQiIHR5cGVmYWNlPSJBcmlhbCIvPjxhOmZvbnQgc2NyaXB0PSJVaWdoIiB0eXBlZmFjZT0iTWljcm9zb2Z0IFVpZ2h1ciIvPjxhOmZvbnQgc2NyaXB0PSJHZW9yIiB0eXBlZmFjZT0iU3lsZmFlbiIvPjxhOmZvbnQgc2NyaXB0PSJBcm1uIiB0eXBlZmFjZT0iQXJpYWwiLz48YTpmb250IHNjcmlwdD0iQnVnaSIgdHlwZWZhY2U9IkxlZWxhd2FkZWUgVUkiLz48YTpmb250IHNjcmlwdD0iQm9wbyIgdHlwZWZhY2U9Ik1pY3Jvc29mdCBKaGVuZ0hlaSIvPjxhOmZvbnQgc2NyaXB0PSJKYXZhIiB0eXBlZmFjZT0iSmF2YW5lc2UgVGV4dCIvPjxhOmZvbnQgc2NyaXB0PSJMaXN1IiB0eXBlZmFjZT0iU2Vnb2UgVUkiLz48YTpmb250IHNjcmlwdD0iTXltciIgdHlwZWZhY2U9Ik15YW5tYXIgVGV4dCIvPjxhOmZvbnQgc2NyaXB0PSJOa29vIiB0eXBlZmFjZT0iRWJyaW1hIi8+PGE6Zm9udCBzY3JpcHQ9Ik9sY2siIHR5cGVmYWNlPSJOaXJtYWxhIFVJIi8+PGE6Zm9udCBzY3JpcHQ9Ik9zbWEiIHR5cGVmYWNlPSJFYnJpbWEiLz48YTpmb250IHNjcmlwdD0iUGhhZyIgdHlwZWZhY2U9IlBoYWdzcGEiLz48YTpmb250IHNjcmlwdD0iU3lybiIgdHlwZWZhY2U9IkVzdHJhbmdlbG8gRWRlc3NhIi8+PGE6Zm9udCBzY3JpcHQ9IlN5cmoiIHR5cGVmYWNlPSJFc3RyYW5nZWxvIEVkZXNzYSIvPjxhOmZvbnQgc2NyaXB0PSJTeXJlIiB0eXBlZmFjZT0iRXN0cmFuZ2VsbyBFZGVzc2EiLz48YTpmb250IHNjcmlwdD0iU29yYSIgdHlwZWZhY2U9Ik5pcm1hbGEgVUkiLz48YTpmb250IHNjcmlwdD0iVGFsZSIgdHlwZWZhY2U9Ik1pY3Jvc29mdCBUYWkgTGUiLz48YTpmb250IHNjcmlwdD0iVGFsdSIgdHlwZWZhY2U9Ik1pY3Jvc29mdCBOZXcgVGFpIEx1ZSIvPjxhOmZvbnQgc2NyaXB0PSJUZm5nIiB0eXBlZmFjZT0iRWJyaW1hIi8+PC9hOm1pbm9yRm9udD48L2E6Zm9udFNjaGVtZT48YTpmbXRTY2hlbWUgbmFtZT0iT2ZmaWNlIj48YTpmaWxsU3R5bGVMc3Q+PGE6c29saWRGaWxsPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIi8+PC9hOnNvbGlkRmlsbD48YTpncmFkRmlsbCByb3RXaXRoU2hhcGU9IjEiPjxhOmdzTHN0PjxhOmdzIHBvcz0iMCI+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiPjxhOmx1bU1vZCB2YWw9IjExMDAwMCIvPjxhOnNhdE1vZCB2YWw9IjEwNTAwMCIvPjxhOnRpbnQgdmFsPSI2NzAwMCIvPjwvYTpzY2hlbWVDbHI+PC9hOmdzPjxhOmdzIHBvcz0iNTAwMDAiPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIj48YTpsdW1Nb2QgdmFsPSIxMDUwMDAiLz48YTpzYXRNb2QgdmFsPSIxMDMwMDAiLz48YTp0aW50IHZhbD0iNzMwMDAiLz48L2E6c2NoZW1lQ2xyPjwvYTpncz48YTpncyBwb3M9IjEwMDAwMCI+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiPjxhOmx1bU1vZCB2YWw9IjEwNTAwMCIvPjxhOnNhdE1vZCB2YWw9IjEwOTAwMCIvPjxhOnRpbnQgdmFsPSI4MTAwMCIvPjwvYTpzY2hlbWVDbHI+PC9hOmdzPjwvYTpnc0xzdD48YTpsaW4gYW5nPSI1NDAwMDAwIiBzY2FsZWQ9IjAiLz48L2E6Z3JhZEZpbGw+PGE6Z3JhZEZpbGwgcm90V2l0aFNoYXBlPSIxIj48YTpnc0xzdD48YTpncyBwb3M9IjAiPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIj48YTpzYXRNb2QgdmFsPSIxMDMwMDAiLz48YTpsdW1Nb2QgdmFsPSIxMDIwMDAiLz48YTp0aW50IHZhbD0iOTQwMDAiLz48L2E6c2NoZW1lQ2xyPjwvYTpncz48YTpncyBwb3M9IjUwMDAwIj48YTpzY2hlbWVDbHIgdmFsPSJwaENsciI+PGE6c2F0TW9kIHZhbD0iMTEwMDAwIi8+PGE6bHVtTW9kIHZhbD0iMTAwMDAwIi8+PGE6c2hhZGUgdmFsPSIxMDAwMDAiLz48L2E6c2NoZW1lQ2xyPjwvYTpncz48YTpncyBwb3M9IjEwMDAwMCI+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiPjxhOmx1bU1vZCB2YWw9Ijk5MDAwIi8+PGE6c2F0TW9kIHZhbD0iMTIwMDAwIi8+PGE6c2hhZGUgdmFsPSI3ODAwMCIvPjwvYTpzY2hlbWVDbHI+PC9hOmdzPjwvYTpnc0xzdD48YTpsaW4gYW5nPSI1NDAwMDAwIiBzY2FsZWQ9IjAiLz48L2E6Z3JhZEZpbGw+PC9hOmZpbGxTdHlsZUxzdD48YTpsblN0eWxlTHN0PjxhOmxuIHc9IjEyNzAwIiBjYXA9ImZsYXQiIGNtcGQ9InNuZyIgYWxnbj0iY3RyIj48YTpzb2xpZEZpbGw+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiLz48L2E6c29saWRGaWxsPjxhOnByc3REYXNoIHZhbD0ic29saWQiLz48YTptaXRlciBsaW09IjgwMDAwMCIvPjwvYTpsbj48YTpsbiB3PSIxOTA1MCIgY2FwPSJmbGF0IiBjbXBkPSJzbmciIGFsZ249ImN0ciI+PGE6c29saWRGaWxsPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIi8+PC9hOnNvbGlkRmlsbD48YTpwcnN0RGFzaCB2YWw9InNvbGlkIi8+PGE6bWl0ZXIgbGltPSI4MDAwMDAiLz48L2E6bG4+PGE6bG4gdz0iMjU0MDAiIGNhcD0iZmxhdCIgY21wZD0ic25nIiBhbGduPSJjdHIiPjxhOnNvbGlkRmlsbD48YTpzY2hlbWVDbHIgdmFsPSJwaENsciIvPjwvYTpzb2xpZEZpbGw+PGE6cHJzdERhc2ggdmFsPSJzb2xpZCIvPjxhOm1pdGVyIGxpbT0iODAwMDAwIi8+PC9hOmxuPjwvYTpsblN0eWxlTHN0PjxhOmVmZmVjdFN0eWxlTHN0PjxhOmVmZmVjdFN0eWxlPjxhOmVmZmVjdExzdC8+PC9hOmVmZmVjdFN0eWxlPjxhOmVmZmVjdFN0eWxlPjxhOmVmZmVjdExzdC8+PC9hOmVmZmVjdFN0eWxlPjxhOmVmZmVjdFN0eWxlPjxhOmVmZmVjdExzdD48YTpvdXRlclNoZHcgYmx1clJhZD0iNTcxNTAiIGRpc3Q9IjE5MDUwIiBkaXI9IjU0MDAwMDAiIGFsZ249ImN0ciIgcm90V2l0aFNoYXBlPSIwIj48YTpzcmdiQ2xyIHZhbD0iMDAwMDAwIj48YTphbHBoYSB2YWw9IjYzMDAwIi8+PC9hOnNyZ2JDbHI+PC9hOm91dGVyU2hkdz48L2E6ZWZmZWN0THN0PjwvYTplZmZlY3RTdHlsZT48L2E6ZWZmZWN0U3R5bGVMc3Q+PGE6YmdGaWxsU3R5bGVMc3Q+PGE6c29saWRGaWxsPjxhOnNjaGVtZUNsciB2YWw9InBoQ2xyIi8+PC9hOnNvbGlkRmlsbD48YTpzb2xpZEZpbGw+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiPjxhOnRpbnQgdmFsPSI5NTAwMCIvPjxhOnNhdE1vZCB2YWw9IjE3MDAwMCIvPjwvYTpzY2hlbWVDbHI+PC9hOnNvbGlkRmlsbD48YTpncmFkRmlsbCByb3RXaXRoU2hhcGU9IjEiPjxhOmdzTHN0PjxhOmdzIHBvcz0iMCI+PGE6c2NoZW1lQ2xyIHZhbD0icGhDbHIiPjxhOnRpbnQgdmFsPSI5MzAwMCIvPjxhOnNhdE1vZCB2YWw9IjE1MDAwMCIvPjxhOnNoYWRlIHZhbD0iOTgwMDAiLz48YTpsdW1Nb2QgdmFsPSIxMDIwMDAiLz48L2E6c2NoZW1lQ2xyPjwvYTpncz48YTpncyBwb3M9IjUwMDAwIj48YTpzY2hlbWVDbHIgdmFsPSJwaENsciI+PGE6dGludCB2YWw9Ijk4MDAwIi8+PGE6c2F0TW9kIHZhbD0iMTMwMDAwIi8+PGE6c2hhZGUgdmFsPSI5MDAwMCIvPjxhOmx1bU1vZCB2YWw9IjEwMzAwMCIvPjwvYTpzY2hlbWVDbHI+PC9hOmdzPjxhOmdzIHBvcz0iMTAwMDAwIj48YTpzY2hlbWVDbHIgdmFsPSJwaENsciI+PGE6c2hhZGUgdmFsPSI2MzAwMCIvPjxhOnNhdE1vZCB2YWw9IjEyMDAwMCIvPjwvYTpzY2hlbWVDbHI+PC9hOmdzPjwvYTpnc0xzdD48YTpsaW4gYW5nPSI1NDAwMDAwIiBzY2FsZWQ9IjAiLz48L2E6Z3JhZEZpbGw+PC9hOmJnRmlsbFN0eWxlTHN0PjwvYTpmbXRTY2hlbWU+PC9hOnRoZW1lRWxlbWVudHM+PGE6b2JqZWN0RGVmYXVsdHM+PGE6bG5EZWY+PGE6c3BQci8+PGE6Ym9keVByLz48YTpsc3RTdHlsZS8+PGE6c3R5bGU+PGE6bG5SZWYgaWR4PSIyIj48YTpzY2hlbWVDbHIgdmFsPSJhY2NlbnQxIi8+PC9hOmxuUmVmPjxhOmZpbGxSZWYgaWR4PSIwIj48YTpzY2hlbWVDbHIgdmFsPSJhY2NlbnQxIi8+PC9hOmZpbGxSZWY+PGE6ZWZmZWN0UmVmIGlkeD0iMSI+PGE6c2NoZW1lQ2xyIHZhbD0iYWNjZW50MSIvPjwvYTplZmZlY3RSZWY+PGE6Zm9udFJlZiBpZHg9Im1pbm9yIj48YTpzY2hlbWVDbHIgdmFsPSJ0eDEiLz48L2E6Zm9udFJlZj48L2E6c3R5bGU+PC9hOmxuRGVmPjwvYTpvYmplY3REZWZhdWx0cz48YTpleHRyYUNsclNjaGVtZUxzdC8+PGE6ZXh0THN0PjxhOmV4dCB1cmk9InswNUE0QzI1Qy0wODVFLTQzNDAtODVBMy1BNTUzMUU1MTBEQjJ9Ij48dGhtMTU6dGhlbWVGYW1pbHkgeG1sbnM6dGhtMTU9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3RoZW1lbWwvMjAxMi9tYWluIiBuYW1lPSJPZmZpY2UgVGhlbWUiIGlkPSJ7MkUxNDJBMkMtQ0QxNi00MkQ2LTg3M0EtQzI2RDJBMDUwNkZBfSIgdmlkPSJ7MUJEREZGNTItNkNENi00MEE1LUFCM0MtNjhFQjJGMUU0RDBBfSIvPjwvYTpleHQ+PC9hOmV4dExzdD48L2E6dGhlbWU+" },
  { name: "xl/styles.xml", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPHN0eWxlU2hlZXQgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9zcHJlYWRzaGVldG1sLzIwMDYvbWFpbiIgeG1sbnM6bWM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9tYXJrdXAtY29tcGF0aWJpbGl0eS8yMDA2IiBtYzpJZ25vcmFibGU9IngxNGFjIHgxNnIyIHhyIiB4bWxuczp4MTRhYz0iaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS9vZmZpY2Uvc3ByZWFkc2hlZXRtbC8yMDA5LzkvYWMiIHhtbG5zOngxNnIyPSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS9zcHJlYWRzaGVldG1sLzIwMTUvMDIvbWFpbiIgeG1sbnM6eHI9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3NwcmVhZHNoZWV0bWwvMjAxNC9yZXZpc2lvbiI+PGZvbnRzIGNvdW50PSIyIiB4MTRhYzprbm93bkZvbnRzPSIxIj48Zm9udD48c3ogdmFsPSIxMSIvPjxjb2xvciB0aGVtZT0iMSIvPjxuYW1lIHZhbD0iQXB0b3MgTmFycm93Ii8+PGZhbWlseSB2YWw9IjIiLz48c2NoZW1lIHZhbD0ibWlub3IiLz48L2ZvbnQ+PGZvbnQ+PHN6IHZhbD0iMTEiLz48Y29sb3IgdGhlbWU9IjEiLz48bmFtZSB2YWw9IkFwdG9zIE5hcnJvdyIvPjxzY2hlbWUgdmFsPSJtaW5vciIvPjwvZm9udD48L2ZvbnRzPjxmaWxscyBjb3VudD0iMiI+PGZpbGw+PHBhdHRlcm5GaWxsIHBhdHRlcm5UeXBlPSJub25lIi8+PC9maWxsPjxmaWxsPjxwYXR0ZXJuRmlsbCBwYXR0ZXJuVHlwZT0iZ3JheTEyNSIvPjwvZmlsbD48L2ZpbGxzPjxib3JkZXJzIGNvdW50PSIxIj48Ym9yZGVyPjxsZWZ0Lz48cmlnaHQvPjx0b3AvPjxib3R0b20vPjxkaWFnb25hbC8+PC9ib3JkZXI+PC9ib3JkZXJzPjxjZWxsU3R5bGVYZnMgY291bnQ9IjEiPjx4ZiBudW1GbXRJZD0iMCIgZm9udElkPSIwIiBmaWxsSWQ9IjAiIGJvcmRlcklkPSIwIi8+PC9jZWxsU3R5bGVYZnM+PGNlbGxYZnMgY291bnQ9IjUiPjx4ZiBudW1GbXRJZD0iMCIgZm9udElkPSIwIiBmaWxsSWQ9IjAiIGJvcmRlcklkPSIwIiB4ZklkPSIwIi8+PHhmIG51bUZtdElkPSIwIiBmb250SWQ9IjEiIGZpbGxJZD0iMCIgYm9yZGVySWQ9IjAiIHhmSWQ9IjAiIGFwcGx5Rm9udD0iMSIvPjx4ZiBudW1GbXRJZD0iMCIgZm9udElkPSIwIiBmaWxsSWQ9IjAiIGJvcmRlcklkPSIwIiB4ZklkPSIwIiBhcHBseUFsaWdubWVudD0iMSI+PGFsaWdubWVudCBob3Jpem9udGFsPSJyaWdodCIvPjwveGY+PHhmIG51bUZtdElkPSIxNCIgZm9udElkPSIwIiBmaWxsSWQ9IjAiIGJvcmRlcklkPSIwIiB4ZklkPSIwIiBhcHBseU51bWJlckZvcm1hdD0iMSIgYXBwbHlBbGlnbm1lbnQ9IjEiPjxhbGlnbm1lbnQgaG9yaXpvbnRhbD0icmlnaHQiLz48L3hmPjx4ZiBudW1GbXRJZD0iMSIgZm9udElkPSIwIiBmaWxsSWQ9IjAiIGJvcmRlcklkPSIwIiB4ZklkPSIwIiBhcHBseU51bWJlckZvcm1hdD0iMSIvPjwvY2VsbFhmcz48Y2VsbFN0eWxlcyBjb3VudD0iMSI+PGNlbGxTdHlsZSBuYW1lPSJOb3JtYWwiIHhmSWQ9IjAiIGJ1aWx0aW5JZD0iMCIvPjwvY2VsbFN0eWxlcz48ZHhmcyBjb3VudD0iMCIvPjx0YWJsZVN0eWxlcyBjb3VudD0iMCIgZGVmYXVsdFRhYmxlU3R5bGU9IlRhYmxlU3R5bGVNZWRpdW0yIiBkZWZhdWx0UGl2b3RTdHlsZT0iUGl2b3RTdHlsZUxpZ2h0MTYiLz48ZXh0THN0PjxleHQgdXJpPSJ7RUI3OURFRjItODBCOC00M2U1LTk1QkQtNTRDQkRERjkwMjBDfSIgeG1sbnM6eDE0PSJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL29mZmljZS9zcHJlYWRzaGVldG1sLzIwMDkvOS9tYWluIj48eDE0OnNsaWNlclN0eWxlcyBkZWZhdWx0U2xpY2VyU3R5bGU9IlNsaWNlclN0eWxlTGlnaHQxIi8+PC9leHQ+PGV4dCB1cmk9Ins5MjYwQTUxMC1GMzAxLTQ2YTgtODYzNS1GNTEyRDY0QkU1RjV9IiB4bWxuczp4MTU9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3NwcmVhZHNoZWV0bWwvMjAxMC8xMS9tYWluIj48eDE1OnRpbWVsaW5lU3R5bGVzIGRlZmF1bHRUaW1lbGluZVN0eWxlPSJUaW1lU2xpY2VyU3R5bGVMaWdodDEiLz48L2V4dD48L2V4dExzdD48L3N0eWxlU2hlZXQ+" },
  { name: "xl/sharedStrings.xml", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPHNzdCB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3NwcmVhZHNoZWV0bWwvMjAwNi9tYWluIiBjb3VudD0iMjMiIHVuaXF1ZUNvdW50PSIyMyI+PHNpPjx0PkRlYnRvciBDb2RlPC90Pjwvc2k+PHNpPjx0PkRhdGU8L3Q+PC9zaT48c2k+PHQ+RGF0ZSBSZXF1aXJlZDwvdD48L3NpPjxzaT48dD5DdXN0b21lciBPcmRlciBObzwvdD48L3NpPjxzaT48dD5Kb2IgTmFtZTwvdD48L3NpPjxzaT48dD5Kb2IgQWRkcmVzcyBMaW5lIDE8L3Q+PC9zaT48c2k+PHQ+Sm9iIEFkZHJlc3MgTGluZSAyPC90Pjwvc2k+PHNpPjx0PkpvYiBBZGRyZXNzIExpbmUgMzwvdD48L3NpPjxzaT48dD5TYWxlcyBSZXAgQ29kZTwvdD48L3NpPjxzaT48dD5CUFMgQlJVTlNXMTc8L3Q+PC9zaT48c2k+PHQ+QlBTMTIzNDwvdD48L3NpPjxzaT48dD5CUFM8L3Q+PC9zaT48c2k+PHQ+MTI1IFN1c3NleCBTdHJlZXQ8L3Q+PC9zaT48c2k+PHQ+UGFzY29lIFZhbGUgVklDIDMwNDQ8L3Q+PC9zaT48c2k+PHQ+QlBTIDA0MDAgMDAwIDAwMDwvdD48L3NpPjxzaT48dD5TdG9jayBDb2RlPC90Pjwvc2k+PHNpPjx0PkRlc2NyaXB0aW9uPC90Pjwvc2k+PHNpPjx0PlF1YW48L3Q+PC9zaT48c2k+PHQ+UmF0ZSBFeDwvdD48L3NpPjxzaT48dD4xM0hEMTIzMDwvdD48L3NpPjxzaT48dD4xM01NIFMvUk9DS1NUQU5EQVJEMTIwMCBYIDMwMDA8L3Q+PC9zaT48c2k+PHQ+UjI1SFMzMDU1PC90Pjwvc2k+PHNpPjx0PjI1TU0gSFNFQ1RJT04gMzAwMDAwNTVCTVQ8L3Q+PC9zaT48L3NzdD4=" },
  { name: "docProps/core.xml", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPGNwOmNvcmVQcm9wZXJ0aWVzIHhtbG5zOmNwPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L21ldGFkYXRhL2NvcmUtcHJvcGVydGllcyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczpkY3Rlcm1zPSJodHRwOi8vcHVybC5vcmcvZGMvdGVybXMvIiB4bWxuczpkY21pdHlwZT0iaHR0cDovL3B1cmwub3JnL2RjL2RjbWl0eXBlLyIgeG1sbnM6eHNpPSJodHRwOi8vd3d3LnczLm9yZy8yMDAxL1hNTFNjaGVtYS1pbnN0YW5jZSI+PGRjOmNyZWF0b3I+QmVsbCBQbGFzdGVyIE1hcmtldGluZzwvZGM6Y3JlYXRvcj48Y3A6bGFzdE1vZGlmaWVkQnk+QmVsbCBQbGFzdGVyIE1hcmtldGluZzwvY3A6bGFzdE1vZGlmaWVkQnk+PGRjdGVybXM6Y3JlYXRlZCB4c2k6dHlwZT0iZGN0ZXJtczpXM0NEVEYiPjIwMjYtMDctMTVUMDU6MTE6MzNaPC9kY3Rlcm1zOmNyZWF0ZWQ+PGRjdGVybXM6bW9kaWZpZWQgeHNpOnR5cGU9ImRjdGVybXM6VzNDRFRGIj4yMDI2LTA3LTE1VDA1OjEzOjUyWjwvZGN0ZXJtczptb2RpZmllZD48L2NwOmNvcmVQcm9wZXJ0aWVzPg==" },
  { name: "docProps/app.xml", base64: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pg0KPFByb3BlcnRpZXMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L2V4dGVuZGVkLXByb3BlcnRpZXMiIHhtbG5zOnZ0PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9kb2NQcm9wc1ZUeXBlcyI+PEFwcGxpY2F0aW9uPk1pY3Jvc29mdCBFeGNlbDwvQXBwbGljYXRpb24+PERvY1NlY3VyaXR5PjA8L0RvY1NlY3VyaXR5PjxTY2FsZUNyb3A+ZmFsc2U8L1NjYWxlQ3JvcD48SGVhZGluZ1BhaXJzPjx2dDp2ZWN0b3Igc2l6ZT0iMiIgYmFzZVR5cGU9InZhcmlhbnQiPjx2dDp2YXJpYW50Pjx2dDpscHN0cj5Xb3Jrc2hlZXRzPC92dDpscHN0cj48L3Z0OnZhcmlhbnQ+PHZ0OnZhcmlhbnQ+PHZ0Omk0PjE8L3Z0Omk0PjwvdnQ6dmFyaWFudD48L3Z0OnZlY3Rvcj48L0hlYWRpbmdQYWlycz48VGl0bGVzT2ZQYXJ0cz48dnQ6dmVjdG9yIHNpemU9IjEiIGJhc2VUeXBlPSJscHN0ciI+PHZ0Omxwc3RyPlNoZWV0MTwvdnQ6bHBzdHI+PC92dDp2ZWN0b3I+PC9UaXRsZXNPZlBhcnRzPjxDb21wYW55PjwvQ29tcGFueT48TGlua3NVcFRvRGF0ZT5mYWxzZTwvTGlua3NVcFRvRGF0ZT48U2hhcmVkRG9jPmZhbHNlPC9TaGFyZWREb2M+PEh5cGVybGlua3NDaGFuZ2VkPmZhbHNlPC9IeXBlcmxpbmtzQ2hhbmdlZD48QXBwVmVyc2lvbj4xNi4wMzAwPC9BcHBWZXJzaW9uPjwvUHJvcGVydGllcz4=" }
];

const SHEET_PREFIX =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
  'mc:Ignorable="x14ac xr xr2 xr3" ' +
  'xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" ' +
  'xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" ' +
  'xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" ' +
  'xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" ' +
  'xr:uid="{E304718E-0F4F-438B-951F-7C317FF962F0}">';

const SHEET_LAYOUT =
  '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
  '<selection activeCell="A1" sqref="A1"/>' +
  '</sheetView></sheetViews>' +
  '<sheetFormatPr defaultRowHeight="15" x14ac:dyDescent="0.25"/>' +
  '<cols>' +
  '<col min="1" max="1" width="18.140625" bestFit="1" customWidth="1"/>' +
  '<col min="2" max="2" width="33.28515625" bestFit="1" customWidth="1"/>' +
  '<col min="3" max="3" width="5.85546875" bestFit="1" customWidth="1"/>' +
  '<col min="4" max="4" width="7.140625" bestFit="1" customWidth="1"/>' +
  '</cols>';

const SHEET_SUFFIX =
  '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" ' +
  'header="0.3" footer="0.3"/>' +
  '</worksheet>';

export function createAccriviaXlsx(data) {
  const productRows = Array.isArray(data.productRows)
    ? data.productRows
    : [];

  if (productRows.length === 0) {
    throw new Error("No verified Accrivia product rows were supplied.");
  }

  const finalRow = 11 + productRows.length;
  const sheetRows = buildSheetRows(data, productRows);

  const sheetXml =
    SHEET_PREFIX +
    `<dimension ref="A1:D${finalRow}"/>` +
    SHEET_LAYOUT +
    `<sheetData>${sheetRows}</sheetData>` +
    SHEET_SUFFIX;

  const entries = STATIC_XLSX_ENTRIES.map((entry) => ({
    name: entry.name,
    bytes: decodeBase64(entry.base64),
  }));

  entries.push({
    name: "xl/worksheets/sheet1.xml",
    bytes: new TextEncoder().encode(sheetXml),
  });

  return {
    bytes: createStoreOnlyZip(entries),
    mimeType: XLSX_MIME,
    finalRow,
  };
}

function buildSheetRows(data, productRows) {
  const labels = [
    "Debtor Code",
    "Date",
    "Date Required",
    "Customer Order No",
    "Job Name",
    "Job Address Line 1",
    "Job Address Line 2",
    "Job Address Line 3",
    "Sales Rep Code",
  ];

  const values = [
    data.debtorCode,
    excelDateSerial(data.orderDate),
    excelDateSerial(data.requiredDate),
    data.orderNumber,
    data.jobName,
    data.addressLine1,
    data.addressLine2,
    data.addressLine3,
    data.salesRepCode,
  ];

  const rows = [];

  for (let row = 1; row <= 9; row += 1) {
    const labelCell = textCell(`A${row}`, 1, labels[row - 1]);

    const valueCell =
      row === 2 || row === 3
        ? numberCell(`B${row}`, 3, values[row - 1])
        : textCell(`B${row}`, 2, values[row - 1]);

    rows.push(rowXml(row, [labelCell, valueCell]));
  }

  rows.push(
    rowXml(11, [
      textCell("A11", 0, "Stock Code"),
      textCell("B11", 0, "Description"),
      textCell("C11", 0, "Quan"),
      textCell("D11", 0, "Rate Ex"),
    ]),
  );

  productRows.forEach((product, index) => {
    const row = 12 + index;

    rows.push(
      rowXml(row, [
        textCell(`A${row}`, 0, product[0]),
        textCell(`B${row}`, 0, product[1]),
        numberCell(`C${row}`, 4, product[2]),
        blankCell(`D${row}`, 4),
      ]),
    );
  });

  return rows.join("");
}

function rowXml(rowNumber, cells) {
  return (
    `<row r="${rowNumber}" spans="1:4" x14ac:dyDescent="0.25">` +
    cells.join("") +
    "</row>"
  );
}

function textCell(reference, styleId, value) {
  const text = value === null || value === undefined
    ? ""
    : String(value);

  if (text === "") {
    return blankCell(reference, styleId);
  }

  const style = styleId > 0 ? ` s="${styleId}"` : "";

  return (
    `<c r="${reference}"${style} t="inlineStr">` +
    "<is>" +
    `<t xml:space="preserve">${xmlEscape(text)}</t>` +
    "</is>" +
    "</c>"
  );
}

function numberCell(reference, styleId, value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return blankCell(reference, styleId);
  }

  const style = styleId > 0 ? ` s="${styleId}"` : "";

  return (
    `<c r="${reference}"${style}>` +
    `<v>${number}</v>` +
    "</c>"
  );
}

function blankCell(reference, styleId) {
  const style = styleId > 0 ? ` s="${styleId}"` : "";
  return `<c r="${reference}"${style}/>`;
}

function excelDateSerial(value) {
  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (!match) {
    throw new Error(`Invalid Accrivia date: ${value || "blank"}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return Math.floor(
    (
      Date.UTC(year, month - 1, day) -
      Date.UTC(1899, 11, 30)
    ) /
    86400000,
  );
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeBase64(value) {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }

  return output;
}

/*
 * Store-only ZIP writer.
 *
 * Accrivia accepted this packaging during the previous generator tests,
 * so this deliberately avoids normal ZIP compression.
 */
function createStoreOnlyZip(entries) {
  const output = [];
  const centralRecords = [];
  const timestamp = getZipDosDateTime(new Date());

  entries.forEach((entry) => {
    const nameBytes = new TextEncoder().encode(entry.name);
    const dataBytes = entry.bytes;
    const checksum = crc32(dataBytes);
    const localOffset = output.length;

    pushUInt32LE(output, 0x04034b50);
    pushUInt16LE(output, 20);
    pushUInt16LE(output, 0);
    pushUInt16LE(output, 0);
    pushUInt16LE(output, timestamp.time);
    pushUInt16LE(output, timestamp.date);
    pushUInt32LE(output, checksum);
    pushUInt32LE(output, dataBytes.length);
    pushUInt32LE(output, dataBytes.length);
    pushUInt16LE(output, nameBytes.length);
    pushUInt16LE(output, 0);
    appendBytes(output, nameBytes);
    appendBytes(output, dataBytes);

    const central = [];

    pushUInt32LE(central, 0x02014b50);
    pushUInt16LE(central, 20);
    pushUInt16LE(central, 20);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, timestamp.time);
    pushUInt16LE(central, timestamp.date);
    pushUInt32LE(central, checksum);
    pushUInt32LE(central, dataBytes.length);
    pushUInt32LE(central, dataBytes.length);
    pushUInt16LE(central, nameBytes.length);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, 0);
    pushUInt16LE(central, 0);
    pushUInt32LE(central, 0x01800000);
    pushUInt32LE(central, localOffset);
    appendBytes(central, nameBytes);

    centralRecords.push(central);
  });

  const centralOffset = output.length;

  centralRecords.forEach((record) => appendBytes(output, record));

  const centralSize = output.length - centralOffset;

  pushUInt32LE(output, 0x06054b50);
  pushUInt16LE(output, 0);
  pushUInt16LE(output, 0);
  pushUInt16LE(output, entries.length);
  pushUInt16LE(output, entries.length);
  pushUInt32LE(output, centralSize);
  pushUInt32LE(output, centralOffset);
  pushUInt16LE(output, 0);

  return Uint8Array.from(output);
}

function appendBytes(target, source) {
  for (const byte of source) {
    target.push(byte & 0xff);
  }
}

function pushUInt16LE(target, value) {
  const number = Number(value) >>> 0;

  target.push(
    number & 0xff,
    (number >>> 8) & 0xff,
  );
}

function pushUInt32LE(target, value) {
  const number = Number(value) >>> 0;

  target.push(
    number & 0xff,
    (number >>> 8) & 0xff,
    (number >>> 16) & 0xff,
    (number >>> 24) & 0xff,
  );
}

function getZipDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());

  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),

    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

let CRC32_TABLE = null;

function crc32(bytes) {
  const table = getCrc32Table();
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc =
      (crc >>> 8) ^
      table[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getCrc32Table() {
  if (CRC32_TABLE) {
    return CRC32_TABLE;
  }

  const table = [];

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value =
        value & 1
          ? 0xedb88320 ^ (value >>> 1)
          : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  CRC32_TABLE = table;
  return table;
}

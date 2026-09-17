# UNIT 06／延遲回應

DATE: 2037-07-07
PURPOSE: 測試其中一端延遲時，另一端是否會保留等待與同步的選項。
PARTICIPANTS: PAIR-06-A／PAIR-06-B
PREPARED BY: 周岑
STATUS: ADVANCED TRAINING

B 端在任務中段延遲回應。A 端可以選擇繼續猜測，也可以保留目前狀態等待 B 端。

A 端先嘗試一次猜測，發現結果不一致後保留原始資料，沒有繼續覆蓋。B 端恢復後，兩端重新完成同步。

研究結論：可接受的合作不只是速度，也包括知道何時停止自行推進。

SIGN: 周岑

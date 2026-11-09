import { ImageResponse } from "next/og";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#080B14",
        color: "#5FA8D3",
        fontSize: 190,
        fontWeight: 900,
        border: "24px solid #5FA8D3",
        borderRadius: 110,
      }}
    >
      SR
    </div>,
    size,
  );
}

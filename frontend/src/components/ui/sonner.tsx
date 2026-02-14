import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      <style>
        {`
          .toaster.group [data-close-button] {
            left: auto !important;
            right: 5px !important;
            top: 5px !important;
            transform: none !important;
          }
        `}
      </style>
      <Sonner
        {...props}
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        position="bottom-right"
        closeButton={true}
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
          } as React.CSSProperties
        }
      />
    </>
  )
}

export { Toaster }

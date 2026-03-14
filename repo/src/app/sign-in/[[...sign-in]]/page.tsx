import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-charcoal-deep px-4 py-24">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-charcoal border border-ivory/10 shadow-2xl",
            headerTitle: "text-ivory font-display",
            headerSubtitle: "text-ivory/60",
            socialButtonsBlockButton:
              "border-ivory/10 text-ivory hover:bg-ivory/5",
            formFieldLabel: "text-ivory/70",
            formFieldInput:
              "bg-charcoal-deep border-ivory/10 text-ivory placeholder:text-ivory/30",
            footerActionLink: "text-gold hover:text-gold/80",
            formButtonPrimary:
              "bg-gold text-charcoal hover:bg-gold/90 font-body uppercase tracking-widest text-sm",
          },
        }}
      />
    </div>
  );
}

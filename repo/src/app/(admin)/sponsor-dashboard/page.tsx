import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function SponsorDashboard() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();

  return (
    <div className="container mx-auto px-4 py-24 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="font-playfair text-4xl text-gold">Sponsor Dashboard</h1>
        
        <div className="bg-charcoal/50 border border-gold/20 rounded-2xl p-8">
          <h2 className="font-satoshi text-2xl text-ivory mb-2">
            Welcome back, {user?.firstName || 'Partner'}
          </h2>
          <p className="text-muted-foreground mb-8 text-ivory/60">
            Manage your sponsorship tiers, assets, and view analytics here.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-charcoal rounded-xl p-6 border border-gold/10 hover:border-gold/40 transition-colors">
              <h3 className="font-playfair text-xl text-gold mb-2">Active Tier</h3>
              <p className="text-2xl font-satoshi text-ivory">Setup Required</p>
            </div>
            <div className="bg-charcoal rounded-xl p-6 border border-gold/10 hover:border-gold/40 transition-colors">
              <h3 className="font-playfair text-xl text-gold mb-2">Total Impressions</h3>
              <p className="text-3xl font-jetbrainsMono text-ivory">0</p>
            </div>
            <div className="bg-charcoal rounded-xl p-6 border border-gold/10 hover:border-gold/40 transition-colors">
              <h3 className="font-playfair text-xl text-gold mb-2">Clicks</h3>
              <p className="text-3xl font-jetbrainsMono text-ivory">0</p>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="font-playfair text-2xl text-ivory border-b border-ivory/10 pb-4">Manage Sponsorship</h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-satoshi text-lg text-gold">Select Tier</h4>
                <select className="w-full rounded-xl border border-ivory/10 bg-charcoal px-4 py-3 font-body text-sm text-ivory focus:border-gold/40 focus:outline-none">
                  <option value="">Choose a tier...</option>
                  <option value="platinum">Platinum ($10,000+)</option>
                  <option value="gold">Gold ($5,000+)</option>
                  <option value="silver">Silver ($2,000+)</option>
                  <option value="community">Community ($500+)</option>
                </select>

                <h4 className="font-satoshi text-lg text-gold mt-6">Upload Company Logo</h4>
                <div className="border border-dashed border-ivory/20 rounded-xl p-6 text-center bg-charcoal/30">
                  <input type="file" className="hidden" id="logo-upload" accept="image/*" />
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    <span className="block text-sm text-ivory/60 mb-2">SVG, PNG, or high-res JPEG</span>
                    <span className="inline-block rounded-full bg-ivory/10 px-4 py-2 text-xs font-semibold text-ivory uppercase tracking-widest hover:bg-gold hover:text-charcoal transition-colors">
                      Browse Files
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-satoshi text-lg text-gold">Placement Preview</h4>
                <div className="aspect-[4/3] rounded-xl border border-ivory/10 bg-charcoal flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-ivory/5 mb-4 animate-pulse"></div>
                  <p className="text-sm font-satoshi text-ivory/40">
                    Upload your logo and select a tier to see AI-generated banner previews in AB Entertainment styling.
                  </p>
                </div>
                <button className="w-full mt-4 rounded-full bg-gold px-6 py-3 text-center font-body text-sm font-semibold uppercase tracking-[0.2em] text-charcoal transition-colors hover:bg-gold-light">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

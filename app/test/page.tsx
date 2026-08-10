export default function TestPage() {
  return (
    <div className="min-h-screen bg-bg-light p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold font-poppins text-deep-teal">
          Tailwind CSS Test Page
        </h1>
        
        <div className="bg-white p-6 rounded-card-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-primary-teal mb-4">
            Testing Custom Colors
          </h2>
          <p className="text-text-dark mb-4">
            If you can see styled colors, fonts, spacing, and shadows, Tailwind is working correctly!
          </p>
          
          <div className="flex gap-4">
            <button className="bg-primary-teal text-white px-6 py-3 rounded-card hover:bg-light-mint transition-colors">
              Primary Button
            </button>
            <button className="bg-transparent border-2 border-primary-teal text-primary-teal px-6 py-3 rounded-card hover:bg-primary-teal hover:text-white transition-colors">
              Secondary Button
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-deep-teal text-white p-4 rounded-card">
            Deep Teal
          </div>
          <div className="bg-primary-teal text-white p-4 rounded-card">
            Primary Teal
          </div>
          <div className="bg-light-mint text-deep-teal p-4 rounded-card">
            Light Mint
          </div>
          <div className="bg-gold-accent text-white p-4 rounded-card">
            Gold Accent
          </div>
          <div className="bg-bg-light border-2 border-text-dark text-text-dark p-4 rounded-card">
            BG Light
          </div>
          <div className="bg-text-dark text-white p-4 rounded-card">
            Text Dark
          </div>
        </div>
      </div>
    </div>
  );
}

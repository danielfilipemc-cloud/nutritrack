import AuraBrand from '../../components/AuraBrand';
import InstallApp from '../../components/InstallApp';

export default function InstallPage(){
 return <main className="shell aura-install-page" id="main-content" tabIndex={-1}>
  <header><AuraBrand compact/><a className="outline link" href="/">Voltar à AURA</a></header>
  <div className="heading"><div><span className="eyebrow">NO TEU TELEMÓVEL</span><h1>AURA contigo</h1><p>A mesma plataforma, numa janela própria.</p></div></div>
  <InstallApp/>
  <section className="panel"><h2>A tua conta acompanha-te</h2><p>A instalação usa a conta da plataforma. A sincronização depende dos módulos ativados e das permissões concedidas; não partilhes a palavra-passe nem a conta de outra pessoa.</p><a className="outline link" href="/aluno">Área do aluno</a></section>
 </main>;
}

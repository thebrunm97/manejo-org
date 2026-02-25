import React, { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface ProductTourProps {
    ready?: boolean;
}

export const ProductTour: React.FC<ProductTourProps> = ({ ready = true }) => {
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('hasSeenTour');

        // Só inicia se: não viu o tour E a página está pronta (ready=true)
        if (hasSeenTour || !ready) return;

        const driverObj = driver({
            showProgress: true,
            progressText: '{{current}} de {{total}}',
            animate: true,
            allowClose: true,
            stagePadding: 5, // Fix visual
            doneBtnText: 'Concluir',
            nextBtnText: 'Próximo',
            prevBtnText: 'Anterior',
            steps: [
                { element: '#tour-welcome', popover: { title: 'Bem-vindo ao Manejo.org', description: 'O seu painel de controlo para certificação orgânica.' } },
                { element: '#tour-pmo-card', popover: { title: 'Plano de Manejo', description: 'Aqui gere o estado do seu plano, culturas e insumos.' } },
                { element: '#tour-sidebar-map', popover: { title: 'Mapa da Propriedade', description: 'Desenhe e visualize os seus talhões através do menu lateral.' } },
                { element: '#tour-whatsapp-card', popover: { title: 'Assistente IA', description: 'Conecte o WhatsApp para enviar áudios e deixar a IA preencher tudo!' } }
            ],
            onDestroyStarted: () => {
                localStorage.setItem('hasSeenTour', 'true');
                driverObj.destroy();
            }
        });

        // Delay seguro para evitar layout shift
        const timer = setTimeout(() => {
            driverObj.drive();
        }, 1500);

        return () => clearTimeout(timer);
    }, [ready]);

    return null;
};

// Adiciona export default para compatibilidade
export default ProductTour;
